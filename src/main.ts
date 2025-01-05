#!/usr/bin/env node

import fsp from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'timers/promises';
import { HELP, PRIVATE_VIDEO_INSTRUCTIONS } from './constants.ts';
import type { VideoInfo } from './types.ts';
import * as api from './api/twitch.ts';
import { parseLink } from './utils/parseLink.ts';
import { getFragsForDownloading } from './utils/getFragsForDownloading.ts';
import {
  getFullVodPath,
  getVideoFormats,
  getVideoFormatsByFullVodPath,
  getVideoFormatsByThumbUrl,
} from './utils/getVideoFormats.ts';
import { mergeFrags } from './utils/mergeFrags.ts';
import { getPath } from './utils/getPath.ts';
import { downloadVideo } from './utils/downloadVideo.ts';
import { downloadLiveVideo } from './utils/downloadLiveVideo.ts';
import { downloadWithStreamlink } from './utils/downloadWithStreamlink.ts';
import {
  getVideoInfoByVideoMeta,
  getVideoInfoByVodPath,
} from './utils/getVideoInfo.ts';

const getArgs = () =>
  parseArgs({
    args: process.argv.slice(2),
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      format: {
        type: 'string',
        short: 'f',
        default: 'best',
      },
      'list-formats': {
        type: 'boolean',
        short: 'F',
        default: false,
      },
      output: {
        type: 'string',
        short: 'o',
      },
      'keep-fragments': {
        type: 'boolean',
        default: false,
      },
      'limit-rate': {
        type: 'string',
        short: 'r',
      },
      'live-from-start': {
        type: 'boolean',
      },
      'retry-streams': {
        type: 'string',
      },
      'download-sections': {
        type: 'string',
      },
      'merge-fragments': {
        type: 'boolean',
      },
    },
    allowPositionals: true,
  });

export type AppArgs = ReturnType<typeof getArgs>;

const main = async () => {
  const args = getArgs();

  if (args.values.help || args.positionals.length === 0) {
    console.log(HELP);
    return;
  }

  if (args.values['merge-fragments']) {
    const [outputPath] = args.positionals;
    const [playlist, allFiles] = await Promise.all([
      fsp.readFile(getPath.playlist(outputPath), 'utf8'),
      fsp.readdir(path.parse(outputPath).dir || '.'),
    ]);
    const frags = getFragsForDownloading(
      '.',
      playlist,
      args.values['download-sections'],
    );
    const existingFrags = frags.filter((frag) => {
      const fragPath = getPath.frag(outputPath, frag.idx + 1);
      return allFiles.includes(path.parse(fragPath).base);
    });
    await mergeFrags(existingFrags, outputPath, true);
    return;
  }

  if (args.positionals.length > 1) throw new Error('Expected only one link');

  const [link] = args.positionals;
  const parsedLink = parseLink(link);

  // link type: vodPath
  if (parsedLink.type === 'vodPath') {
    const formats = await getVideoFormatsByFullVodPath(
      getFullVodPath(parsedLink.vodPath),
    );
    const videoInfo = getVideoInfoByVodPath(parsedLink);
    return downloadVideo(formats, videoInfo, () => false, args);
  }

  // link type: video
  if (parsedLink.type === 'video') {
    let [formats, videoMeta] = await Promise.all([
      getVideoFormats(parsedLink.videoId),
      api.getVideoMetadata(parsedLink.videoId),
    ]);
    // should work for sub only VODs and highlights
    if (formats.length === 0 && videoMeta !== null) {
      console.log('Trying to get playlist url from video metadata');
      formats = await getVideoFormatsByThumbUrl(
        videoMeta.broadcastType,
        videoMeta.id,
        videoMeta.previewThumbnailURL,
      );
    }
    if (formats.length === 0 || !videoMeta) {
      return console.log(PRIVATE_VIDEO_INSTRUCTIONS);
    }
    const videoInfo = getVideoInfoByVideoMeta(videoMeta);
    return downloadVideo(formats, videoInfo, () => false, args);
  }

  // link type: channel
  const { channelLogin } = parsedLink;
  let retryStreamsDelay = 0;
  if (args.values['retry-streams']) {
    retryStreamsDelay = Number.parseInt(args.values['retry-streams']);
    if (!retryStreamsDelay || retryStreamsDelay < 0) {
      throw new Error('Wrong --retry-streams delay');
    }
  }
  const isLiveFromStart = args.values['live-from-start'];

  // not retry
  if (!retryStreamsDelay) {
    const streamMeta = await api.getStreamMetadata(channelLogin);
    if (!streamMeta) return;
    if (!streamMeta.stream) {
      console.warn('The channel is not currently live');
      return;
    }

    // not from start
    if (!isLiveFromStart) {
      return await downloadWithStreamlink(
        `https://www.twitch.tv/${channelLogin}`,
        streamMeta,
        channelLogin,
        args,
      );
    }

    // from start
    if (isLiveFromStart) {
      return await downloadLiveVideo(streamMeta, channelLogin, args);
    }
  }

  // retry
  while (true) {
    const streamMeta = await api.getStreamMetadata(channelLogin);
    const isLive = !!streamMeta?.stream;
    if (!isLive) {
      console.log(
        `Waiting for streams, retrying every ${retryStreamsDelay} second(s)`,
      );
    }

    // not from start
    if (isLive && !isLiveFromStart) {
      await downloadWithStreamlink(
        `https://www.twitch.tv/${channelLogin}`,
        streamMeta,
        channelLogin,
        args,
      );
    }

    // from start
    if (isLive && isLiveFromStart) {
      const isSuccess = await downloadLiveVideo(streamMeta, channelLogin, args);
      if (!isSuccess) {
        console.log(
          `Waiting for VOD, retrying every ${retryStreamsDelay} second(s)`,
        );
      }
    }

    await sleep(retryStreamsDelay * 1000);
  }
};

main().catch((e) => {
  // throw e;
  console.error(e.message);
});
