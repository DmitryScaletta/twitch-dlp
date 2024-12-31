#!/usr/bin/env node

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'timers/promises';
import { HELP, PRIVATE_VIDEO_INSTRUCTIONS } from './constants.ts';
import { parseLink } from './utils/parseLink.ts';
import * as api from './api/twitch.ts';
import { spawn } from './lib/spawn.ts';
import { fetchText } from './utils/fetchText.ts';
import { getFragsForDownloading } from './utils/getFragsForDownloading.ts';
import { showProgress } from './utils/showProgress.ts';
import { downloadAndRetry } from './downloaders.ts';
import {
  getFullVodPath,
  getVideoFormats,
  getVideoFormatsByFullVodPath,
  getVideoFormatsByThumbUrl,
} from './utils/getVideoFormats.ts';
import type { DownloadFormat, Frag, FragMetadata, VideoInfo } from './types.ts';

const getPlaylistFilename = (filename: string) => `${filename}-playlist.txt`;
const getFfconcatFilename = (filename: string) => `${filename}-ffconcat.txt`;
const getFragFilename = (filename: string, i: number) =>
  `${filename}.part-Frag${i}`;

const getStreamInfo = (
  channel: api.StreamMetadataResponse,
  channelLogin: string,
): VideoInfo => ({
  id: channel.stream!.id,
  title: channel.lastBroadcast.title || 'Untitled Broadcast',
  uploader: channelLogin,
  uploader_id: channel.id,
  upload_date: channel.stream!.createdAt,
  release_date: channel.stream!.createdAt,
  ext: 'mp4',
});

const getVideoInfo = (video: api.VideoMetadataResponse): VideoInfo => ({
  id: `v${video.id}`,
  title: video.title || 'Untitled Broadcast',
  description: video.description,
  duration: video.lengthSeconds,
  uploader: video.owner.displayName,
  uploader_id: video.owner.login,
  upload_date: video.createdAt,
  release_date: video.publishedAt,
  view_count: video.viewCount,
  ext: 'mp4',
});

const getOutputFilename = (template: string, videoInfo: VideoInfo) => {
  let outputFilename = template;
  for (const [name, value] of Object.entries(videoInfo)) {
    let newValue = value ? String(value) : '';
    if (name.endsWith('_date')) newValue = newValue.slice(0, 10);
    outputFilename = outputFilename.replaceAll(`%(${name})s`, newValue);
  }
  return path.resolve('.', outputFilename.replace(/[/\\?%*:|"'<>]/g, ''));
};

const downloadWithStreamlink = async (
  link: string,
  channel: api.StreamMetadataResponse,
  channelLogin: string,
  args: AppArgs,
) => {
  const getDefaultOutputTemplate = () => {
    const now = new Date()
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')
      .replace(':', '_');
    return `%(uploader)s (live) ${now} [%(id)s].%(ext)s`;
  };

  if (args.values['list-formats']) {
    await spawn('streamlink', ['-v', link]);
    process.exit();
  }

  const outputFilename = getOutputFilename(
    args.values.output || getDefaultOutputTemplate(),
    getStreamInfo(channel, channelLogin),
  );

  const streamlinkArgs = [
    '-o',
    outputFilename,
    link,
    args.values.format,
    '--twitch-disable-ads',
  ];
  return spawn('streamlink', streamlinkArgs);
};

// https://github.com/ScrubN/TwitchDownloader/blob/master/TwitchDownloaderCore/VideoDownloader.cs#L337
const runFfconcat = (ffconcatFilename: string, outputFilename: string) =>
  // prettier-ignore
  spawn('ffmpeg', [
    '-avoid_negative_ts', 'make_zero',
    '-analyzeduration', '2147483647',
    '-probesize', '2147483647',
    '-max_streams', '2147483647',
    '-n',
    '-f', 'concat',
    '-safe', '0',
    '-i', ffconcatFilename,
    '-c', 'copy',
    outputFilename,
  ]);

const mergeFrags = async (
  frags: Frag[],
  outputFilename: string,
  keepFragments: boolean,
) => {
  // https://github.com/ScrubN/TwitchDownloader/blob/master/TwitchDownloaderCore/Tools/FfmpegConcatList.cs#L30-L35
  let ffconcat = 'ffconcat version 1.0\n';
  ffconcat += frags
    .map((frag) =>
      [
        `file '${getFragFilename(outputFilename, frag.idx + 1)}'`,
        'stream',
        'exact_stream_id 0x100', // audio
        'stream',
        'exact_stream_id 0x101', // video
        'stream',
        'exact_stream_id 0x102', // subtitles
        `duration ${frag.duration}`,
      ].join('\n'),
    )
    .join('\n');
  const ffconcatFilename = getFfconcatFilename(outputFilename);
  await fsp.writeFile(ffconcatFilename, ffconcat);

  const returnCode = await runFfconcat(ffconcatFilename, outputFilename);
  fsp.unlink(ffconcatFilename);

  if (keepFragments || returnCode) return;

  await Promise.all([
    ...frags.map((frag) =>
      fsp.unlink(getFragFilename(outputFilename, frag.idx + 1)),
    ),
    fsp.unlink(getPlaylistFilename(outputFilename)),
  ]);
};

const downloadVideo = async (
  formats: DownloadFormat[],
  videoInfo: VideoInfo,
  getIsLive: () => boolean | Promise<boolean>,
  args: AppArgs,
) => {
  const DEFAULT_OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s';
  const WAIT_BETWEEN_CYCLES_SECONDS = 60;

  if (args.values['list-formats']) {
    console.table(formats.map(({ url, ...rest }) => rest));
    process.exit();
  }

  const downloadFormat =
    args.values.format === 'best'
      ? formats[0]
      : formats.find((f) => f.format_id === args.values.format);
  if (!downloadFormat) throw new Error('Wrong format');

  let outputFilename;
  let playlistFilename;
  let isLive;
  let frags;
  let fragsCount = 0;
  const fragsMetadata: FragMetadata[] = [];
  while (true) {
    let playlist;
    [playlist, isLive] = await Promise.all([
      fetchText(downloadFormat.url, 'playlist'),
      getIsLive(),
    ]);
    if (!playlist) {
      console.log(
        `Can't fetch playlist. Retry after ${WAIT_BETWEEN_CYCLES_SECONDS} second(s)`,
      );
      await sleep(WAIT_BETWEEN_CYCLES_SECONDS * 1000);
      continue;
    }
    frags = getFragsForDownloading(
      downloadFormat.url,
      playlist,
      args.values['download-sections'],
    );
    if (!outputFilename || !playlistFilename) {
      outputFilename = getOutputFilename(
        args.values.output || DEFAULT_OUTPUT_TEMPLATE,
        videoInfo,
      );
      playlistFilename = getPlaylistFilename(outputFilename);
    }
    await fsp.writeFile(playlistFilename, playlist);

    const hasNewFrags = frags.length > fragsCount;
    fragsCount = frags.length;
    if (!hasNewFrags && isLive) {
      console.log(
        `Waiting for new segments, retrying every ${WAIT_BETWEEN_CYCLES_SECONDS} second(s)`,
      );
      await sleep(WAIT_BETWEEN_CYCLES_SECONDS * 1000);
      continue;
    }

    let downloadedFragments = 0;
    for (let [i, frag] of frags.entries()) {
      const fragFilename = path.resolve(
        '.',
        getFragFilename(outputFilename, frag.idx + 1),
      );
      const fragFilenameTmp = `${fragFilename}.part`;
      if (fs.existsSync(fragFilename)) continue;
      showProgress(frags, fragsMetadata, i + 1);
      if (fs.existsSync(fragFilenameTmp)) {
        await fsp.unlink(fragFilenameTmp);
      }

      if (frag.url.endsWith('-unmuted.ts')) {
        frag.url = frag.url.replace('-unmuted.ts', '-muted.ts');
      }

      const startTime = Date.now();
      await downloadAndRetry(
        frag.url,
        fragFilenameTmp,
        args.values['limit-rate'],
      );
      const endTime = Date.now();
      await fsp.rename(fragFilenameTmp, fragFilename);
      const { size } = await fsp.stat(fragFilename);
      fragsMetadata.push({ size, time: endTime - startTime });
      downloadedFragments += 1;
    }
    if (downloadedFragments) process.stdout.write('\n');

    if (!isLive) break;
  }

  await mergeFrags(frags, outputFilename, args.values['keep-fragments']);
};

const downloadVideoFromStart = async (
  channel: api.StreamMetadataResponse,
  channelLogin: string,
  args: AppArgs,
) => {
  const WAIT_AFTER_STREAM_ENDED_SECONDS = 8 * 60;

  let formats: DownloadFormat[] = [];
  let videoInfo: VideoInfo;
  let videoId: string;

  if (!channel.stream) return false; // make ts happy

  const broadcast = await api.getBroadcast(channel.id);

  // public VOD
  if (broadcast?.stream?.archiveVideo) {
    videoId = broadcast.stream.archiveVideo.id;
    [formats, videoInfo] = await Promise.all([
      getVideoFormats(videoId),
      // @ts-expect-error
      api.getVideoMetadata(videoId).then(getVideoInfo),
    ]);
  }

  // private VOD
  if (!broadcast?.stream?.archiveVideo || formats.length === 0) {
    console.warn(
      "Couldn't find an archived video for the current broadcast. Trying to recover VOD url",
    );
    let contentMetadata: api.ContentMetadataResponse | null;
    const startTimestamp = new Date(channel.stream.createdAt).getTime() / 1000;
    const vodPath = `${channelLogin}_${channel.stream.id}_${startTimestamp}`;
    [formats, contentMetadata] = await Promise.all([
      getVideoFormatsByFullVodPath(getFullVodPath(vodPath)),
      api.getContentMetadata(channelLogin),
    ]);
    videoInfo = {
      id: `v${channel.stream.id}`,
      title: contentMetadata?.broadcastSettings.title || 'Untitled Broadcast',
      uploader: channelLogin,
      uploader_id: channelLogin,
      upload_date: channel.stream.createdAt,
      release_date: channel.stream.createdAt,
      ext: 'mp4',
    };
  }

  // To be able to download full vod we need to wait about 5 minutes after the end of the stream
  const streamId = broadcast?.stream?.id;
  let lastLiveTimestamp = Date.now();
  const getIsVodLive = (video: api.VideoMetadataResponse) =>
    /\/404_processing_[^.?#]+\.png/.test(video.previewThumbnailURL);
  const getSecondsAfterStreamEnded = (video: api.VideoMetadataResponse) => {
    const started = new Date(video.publishedAt);
    const ended = new Date(started.getTime() + video.lengthSeconds * 1000);
    return Math.floor((Date.now() - ended.getTime()) / 1000);
  };
  const getIsLive = async () => {
    let video;
    if (videoId) {
      video = await api.getVideoMetadata(videoId);
      const isLive = !video || getIsVodLive(video);
      if (isLive) return true;
      const secondsAfterEnd = getSecondsAfterStreamEnded(video!);
      return WAIT_AFTER_STREAM_ENDED_SECONDS - secondsAfterEnd > 0;
    }
    if (!videoId || !video) {
      const broadcast = await api.getBroadcast(channel.id);
      if (!broadcast?.stream || broadcast.stream.id !== streamId) {
        const secondsAfterEnd = (Date.now() - lastLiveTimestamp) / 1000;
        return WAIT_AFTER_STREAM_ENDED_SECONDS - secondsAfterEnd > 0;
      } else {
        lastLiveTimestamp = Date.now();
        return true;
      }
    }
    return false;
  };

  if (formats.length === 0) {
    console.warn("Couldn't find VOD url");
    return false;
  }

  await downloadVideo(formats, videoInfo!, getIsLive, args);
  return true;
};

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

type AppArgs = ReturnType<typeof getArgs>;

const main = async () => {
  const args = getArgs();

  if (args.values.help || args.positionals.length === 0) {
    console.log(HELP);
    return;
  }

  if (args.values['merge-fragments']) {
    const [filename] = args.positionals;
    const [playlist, allFiles] = await Promise.all([
      fsp.readFile(getPlaylistFilename(filename), 'utf8'),
      fsp.readdir(path.parse(filename).dir || '.'),
    ]);
    const frags = getFragsForDownloading(
      '.',
      playlist,
      args.values['download-sections'],
    );
    const existingFrags = frags.filter((frag) => {
      const fragFilename = getFragFilename(filename, frag.idx + 1);
      return allFiles.includes(path.parse(fragFilename).base);
    });
    await mergeFrags(existingFrags, filename, true);
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

main().catch((e) => console.error(e.message));
