#!/usr/bin/env node
import fsp from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import * as api from './api/twitch.ts';
import { MERGE_METHODS, PRIVATE_VIDEO_INSTRUCTIONS } from './constants.ts';
import { chalk } from './lib/chalk.ts';
import { mergeFrags } from './merge/index.ts';
import type { Downloader, MergeMethod } from './types.ts';
import { downloadVideo } from './utils/downloadVideo.ts';
import { downloadWithStreamlink } from './utils/downloadWithStreamlink.ts';
import { getDownloader } from './utils/getDownloader.ts';
import { getExistingFrags } from './utils/getExistingFrags.ts';
import { getFragsForDownloading } from './utils/getFragsForDownloading.ts';
import { getLiveVideoInfo } from './utils/getLiveVideoInfo.ts';
import { getLiveVideoStatus } from './utils/getLiveVideoStatus.ts';
import { getPath } from './utils/getPath.ts';
import {
  getFullVodPath,
  getVideoFormats,
  getVideoFormatsByFullVodPath,
  getVideoFormatsByThumbUrl,
} from './utils/getVideoFormats.ts';
import {
  getVideoInfoByVideoMeta,
  getVideoInfoByVodPath,
} from './utils/getVideoInfo.ts';
import { parseLink } from './utils/parseLink.ts';
import { processUnmutedFrags } from './utils/processUnmutedFrags.ts';
import { readOutputDir } from './utils/readOutputDir.ts';

const getArgs = () =>
  parseArgs({
    args: process.argv.slice(2),
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      version: {
        type: 'boolean',
      },
      format: {
        type: 'string',
        short: 'f',
        default: 'best',
      },
      'list-formats': {
        type: 'boolean',
        short: 'F',
      },
      output: {
        type: 'string',
        short: 'o',
      },
      downloader: {
        type: 'string',
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
      unmute: {
        type: 'string',
      },
      'merge-fragments': {
        type: 'boolean',
      },
      'merge-method': {
        type: 'string',
        default: 'ffconcat',
      },
      // streamlink twitch plugin args
      // https://streamlink.github.io/cli.html#twitch
      'twitch-disable-ads': { type: 'boolean' },
      'twitch-low-latency': { type: 'boolean' },
      'twitch-api-header': { type: 'string', multiple: true },
      'twitch-access-token-param': { type: 'string', multiple: true },
      'twitch-force-client-integrity': { type: 'boolean' },
      'twitch-purge-client-integrity': { type: 'boolean' },
    },
    allowPositionals: true,
  });

export type AppArgs = ReturnType<typeof getArgs>['values'] & {
  downloader: Downloader;
  'merge-method': MergeMethod;
};

const main = async () => {
  const parsedArgs = getArgs();
  const args = parsedArgs.values as AppArgs;
  const positionals = parsedArgs.positionals;

  if (args.version) {
    const pkg = await fsp.readFile('./package.json', 'utf8');
    console.log(JSON.parse(pkg).version);
    return;
  }

  if (args.help || parsedArgs.positionals.length === 0) {
    const readme = await fsp.readFile('./README.md', 'utf8');
    const entries = readme.split(/\s## (.*)/g).slice(1);
    const sections: Record<string, string> = {};
    for (let i = 0; i < entries.length; i += 2) {
      const header = entries[i];
      const content = entries[i + 1].trim();
      sections[header] = content;
    }
    console.log('Options:');
    console.log(sections.Options.replace(/^```\w+\n(.*)\n```$/s, '$1'));
    console.log('');
    console.log('Dependencies:');
    console.log(sections.Dependencies.replaceAll('**', ''));
    return;
  }

  args.downloader = await getDownloader(args.downloader);
  if (!MERGE_METHODS.includes(args['merge-method'])) {
    throw new Error(`Unknown merge method. Available: ${MERGE_METHODS}`);
  }

  if (args['merge-fragments']) {
    const [outputPath] = positionals;
    const [playlist, dir] = await Promise.all([
      fsp.readFile(getPath.playlist(outputPath), 'utf8'),
      readOutputDir(outputPath),
    ]);
    const frags = getFragsForDownloading(
      '.',
      playlist,
      args['download-sections'],
    );
    const existingFrags = getExistingFrags(frags, outputPath, dir);
    await processUnmutedFrags(existingFrags, outputPath, dir);
    await mergeFrags(args['merge-method'], existingFrags, outputPath, true);
    return;
  }

  if (positionals.length > 1) throw new Error('Expected only one link');

  const [link] = positionals;
  const parsedLink = parseLink(link);

  // link type: vodPath
  if (parsedLink.type === 'vodPath') {
    const formats = await getVideoFormatsByFullVodPath(
      getFullVodPath(parsedLink.vodPath),
    );
    const videoInfo = getVideoInfoByVodPath(parsedLink);
    return downloadVideo(formats, videoInfo, args);
  }

  // link type: video
  if (parsedLink.type === 'video') {
    let [formats, videoMeta] = await Promise.all([
      getVideoFormats(parsedLink.videoId),
      api.getVideoMetadata(parsedLink.videoId),
    ]);
    // should work for VODs and highlights
    if (formats.length === 0 && videoMeta !== null) {
      console.log('Trying to get playlist from video metadata');
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
    return downloadVideo(formats, videoInfo, args);
  }

  // link type: channel
  const { channelLogin } = parsedLink;
  let retryStreamsDelay = 0;
  if (args['retry-streams']) {
    retryStreamsDelay = Number.parseInt(args['retry-streams']);
    if (!retryStreamsDelay || retryStreamsDelay < 0) {
      throw new Error('Wrong --retry-streams delay');
    }
  }
  const isLiveFromStart = args['live-from-start'];
  const isRetry = retryStreamsDelay > 0;

  while (true) {
    const streamMeta = await api.getStreamMetadata(channelLogin);
    const isLive = !!streamMeta?.stream;
    if (!isLive) {
      if (isRetry) {
        console.log(
          `[retry-streams] Waiting for streams. Retry every ${retryStreamsDelay} second(s)`,
        );
      } else {
        console.warn('[download] The channel is not currently live');
        return;
      }
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
      const liveVideoInfo = await getLiveVideoInfo(streamMeta, channelLogin);
      if (liveVideoInfo) {
        const { formats, videoInfo, videoId } = liveVideoInfo;
        const getLiveVideoStatusFn = () =>
          getLiveVideoStatus(videoId, streamMeta.stream!.id, channelLogin);
        await downloadVideo(formats, videoInfo, args, getLiveVideoStatusFn);
      } else {
        let message = `[live-from-start] Cannot find the playlist`;
        if (isRetry) {
          message += `. Retry every ${retryStreamsDelay} second(s)`;
          console.warn(message);
        } else {
          console.warn(message);
          return;
        }
      }
    }

    await sleep(retryStreamsDelay * 1000);
  }
};

main().catch((e) => console.error(chalk.red('ERROR:'), e.message));
