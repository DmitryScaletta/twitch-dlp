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
import { getFilename } from './utils/getFilename.ts';
import { downloadVideo } from './utils/downloadVideo.ts';
import { downloadVideoFromStart } from './utils/downloadVideoFromStart.ts';
import { downloadWithStreamlink } from './utils/downloadWithStreamlink.ts';
import { getVideoInfo } from './utils/getVideoInfo.ts';

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
    const [outputFilename] = args.positionals;
    const [playlist, allFiles] = await Promise.all([
      fsp.readFile(getFilename.playlist(outputFilename), 'utf8'),
      fsp.readdir(path.parse(outputFilename).dir || '.'),
    ]);
    const frags = getFragsForDownloading(
      '.',
      playlist,
      args.values['download-sections'],
    );
    const existingFrags = frags.filter((frag) => {
      const fragFilename = getFilename.frag(outputFilename, frag.idx + 1);
      return allFiles.includes(path.parse(fragFilename).base);
    });
    await mergeFrags(existingFrags, outputFilename, true);
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
    const [channelLogin, videoId, startTimestamp] =
      parsedLink.vodPath.split('_');
    const videoInfo: VideoInfo = {
      id: videoId,
      title: `${channelLogin}_${startTimestamp}`,
      ext: 'mp4',
    };
    return downloadVideo(formats, videoInfo, () => false, args);
  }

  // link type: video
  if (parsedLink.type === 'video') {
    let [formats, video] = await Promise.all([
      getVideoFormats(parsedLink.videoId),
      api.getVideoMetadata(parsedLink.videoId),
    ]);

    // should work for sub only VODs and highlights
    if (formats.length === 0 && video !== null) {
      console.log('Trying to get playlist url from video metadata');
      formats = await getVideoFormatsByThumbUrl(
        video.broadcastType,
        video.id,
        video.previewThumbnailURL,
      );
    }
    if (formats.length === 0 || !video) {
      return console.log(PRIVATE_VIDEO_INSTRUCTIONS);
    }
    return downloadVideo(formats, getVideoInfo(video), () => false, args);
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
    const channel = await api.getStreamMetadata(channelLogin);
    if (!channel) return;
    if (!channel.stream) {
      console.warn('The channel is not currently live');
      return;
    }

    // not from start
    if (!isLiveFromStart) {
      return await downloadWithStreamlink(
        `https://www.twitch.tv/${channelLogin}`,
        channel,
        channelLogin,
        args,
      );
    }

    // from start
    if (isLiveFromStart) {
      return await downloadVideoFromStart(channel, channelLogin, args);
    }
  }

  // retry
  while (true) {
    const channel = await api.getStreamMetadata(channelLogin);
    if (!channel) {
      await sleep(retryStreamsDelay * 1000);
      continue;
    }
    const isLive = !!channel.stream;
    if (!isLive) {
      console.log(
        `Waiting for streams, retrying every ${retryStreamsDelay} second(s)`,
      );
    }

    // not from start
    if (isLive && !isLiveFromStart) {
      await downloadWithStreamlink(
        `https://www.twitch.tv/${channelLogin}`,
        channel,
        channelLogin,
        args,
      );
    }

    // from start
    if (isLive && isLiveFromStart) {
      const result = await downloadVideoFromStart(channel, channelLogin, args);
      if (!result) {
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
