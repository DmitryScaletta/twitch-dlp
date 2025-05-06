import fsp from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { LIVE_VIDEO_STATUS, NO_TRY_UNMUTE_MESSAGE } from '../constants.ts';
import { chalk } from '../lib/chalk.ts';
import { isInstalled } from '../lib/isInstalled.ts';
import { statsOrNull } from '../lib/statsOrNull.ts';
import { mergeFrags } from '../merge/index.ts';
import {
  createLogger,
  DL_EVENT,
  logFragsForDownloading,
  logUnmuteResult,
  showStats,
} from '../stats.ts';
import type {
  AppArgs,
  DownloadFormat,
  Frag,
  FragMetadata,
  LiveVideoMeta,
  LiveVideoStatus,
  VideoInfo,
} from '../types.ts';
import { downloadFrag } from './downloadFrag.ts';
import { fetchText } from './fetchText.ts';
import { getExistingFrags } from './getExistingFrags.ts';
import { getFragsForDownloading } from './getFragsForDownloading.ts';
import { getLiveVideoStatus } from './getLiveVideoStatus.ts';
import { getPath } from './getPath.ts';
import { getTryUnmute } from './getTryUnmute.ts';
import { getUnmutedFrag, type UnmutedFrag } from './getUnmutedFrag.ts';
import { processUnmutedFrags } from './processUnmutedFrags.ts';
import { readOutputDir } from './readOutputDir.ts';
import { showProgress } from './showProgress.ts';

const DEFAULT_OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s';
const WAIT_BETWEEN_CYCLES_SEC = 60;

const RETRY_MESSAGE = `Retry every ${WAIT_BETWEEN_CYCLES_SEC} second(s)`;

export const downloadVideo = async (
  formats: DownloadFormat[],
  videoInfo: VideoInfo,
  args: AppArgs,
  liveVideoMeta?: LiveVideoMeta,
) => {
  if (args['list-formats']) {
    console.table(formats.map(({ url, ...rest }) => rest));
    process.exit();
  }

  if (!(await isInstalled('ffmpeg'))) {
    throw new Error(
      'ffmpeg is not installed. Install it from https://ffmpeg.org/',
    );
  }

  const dlFormat =
    args.format === 'best'
      ? formats[0]
      : formats.find(
          (f) => f.format_id.toLowerCase() === args.format.toLowerCase(),
        );
  if (!dlFormat) throw new Error('Wrong format');

  const outputPath = getPath.output(
    args.output || DEFAULT_OUTPUT_TEMPLATE,
    videoInfo,
  );
  let liveVideoStatus: LiveVideoStatus;
  let frags: Frag[];
  let fragsCount = 0;
  let playlistUrl = dlFormat.url;
  const downloadedFrags = new Map<number, FragMetadata>();

  const logPath = getPath.log(outputPath);
  const writeLog = createLogger(logPath);

  const tryUnmute = getTryUnmute(videoInfo);
  if (tryUnmute === false) console.warn(NO_TRY_UNMUTE_MESSAGE);

  writeLog([
    DL_EVENT.INIT,
    { args, formats, outputPath, playlistUrl, videoInfo },
  ]);

  const getLiveVideoStatusFn = liveVideoMeta
    ? () => getLiveVideoStatus(liveVideoMeta, frags)
    : () => LIVE_VIDEO_STATUS.FINALIZED;

  while (true) {
    let playlist;
    [playlist, liveVideoStatus] = await Promise.all([
      fetchText(playlistUrl, 'playlist'),
      getLiveVideoStatusFn(),
    ]);
    writeLog([DL_EVENT.LIVE_VIDEO_STATUS, liveVideoStatus]);
    // workaround for some old muted highlights
    if (!playlist) {
      writeLog([DL_EVENT.FETCH_PLAYLIST_FAILURE]);
      const newPlaylistUrl = dlFormat.url.replace(/-muted-\w+(?=\.m3u8$)/, '');
      if (newPlaylistUrl !== playlistUrl) {
        playlist = await fetchText(playlistUrl, 'playlist (attempt #2)');
        if (playlist) {
          playlistUrl = newPlaylistUrl;
          writeLog([DL_EVENT.FETCH_PLAYLIST_OLD_MUTED_SUCCESS, playlistUrl]);
        } else {
          writeLog([DL_EVENT.FETCH_PLAYLIST_OLD_MUTED_FAILURE]);
        }
      }
    }
    if (!playlist && liveVideoStatus === LIVE_VIDEO_STATUS.FINALIZED) {
      throw new Error('Cannot download the playlist');
    }
    if (!playlist) {
      console.warn(
        `[live-from-start] Waiting for the playlist. ${RETRY_MESSAGE}`,
      );
      await sleep(WAIT_BETWEEN_CYCLES_SEC * 1000);
      continue;
    }
    writeLog([DL_EVENT.FETCH_PLAYLIST_SUCCESS]);

    frags = getFragsForDownloading(playlistUrl, playlist, args);
    writeLog(logFragsForDownloading(frags));

    await fsp.writeFile(getPath.playlist(outputPath), playlist);

    const hasNewFrags = frags.length > fragsCount;
    fragsCount = frags.length;
    if (!hasNewFrags && liveVideoStatus !== LIVE_VIDEO_STATUS.FINALIZED) {
      let message = '[live-from-start] ';
      message +=
        liveVideoStatus === LIVE_VIDEO_STATUS.ONLINE
          ? `${chalk.green('VOD ONLINE')}: waiting for new fragments`
          : `${chalk.red('VOD OFFLINE')}: waiting for the finalization`;
      console.log(`${message}. ${RETRY_MESSAGE}`);
      await sleep(WAIT_BETWEEN_CYCLES_SEC * 1000);
      continue;
    }

    for (const [i, frag] of frags.entries()) {
      showProgress(downloadedFrags, fragsCount);

      const fragPath = getPath.frag(outputPath, frag.idx + 1);
      const fragStats = await statsOrNull(fragPath);
      if (fragStats) {
        if (!downloadedFrags.has(i)) {
          downloadedFrags.set(i, { size: fragStats.size, time: 0 });
          showProgress(downloadedFrags, fragsCount);
        }
        continue;
      }

      if (frag.url.endsWith('-unmuted.ts')) {
        writeLog([DL_EVENT.FRAG_RENAME_UNMUTED, frag.idx]);
        frag.url = frag.url.replace('-unmuted', '-muted');
      }
      let unmutedFrag: UnmutedFrag | null = null;
      if (frag.url.endsWith('-muted.ts')) {
        writeLog([DL_EVENT.FRAG_MUTED, frag.idx]);
        if (tryUnmute) {
          unmutedFrag = await getUnmutedFrag(
            args.downloader,
            args.unmute,
            frag.url,
            formats,
          );
          writeLog(logUnmuteResult(unmutedFrag, frag.idx));
        }
      }

      let fragGzip: boolean | undefined = undefined;
      if (unmutedFrag && unmutedFrag.sameFormat) {
        frag.url = unmutedFrag.url;
        fragGzip = unmutedFrag.gzip;
      }
      let fragMeta = await downloadFrag(
        args.downloader,
        frag.url,
        fragPath,
        args['limit-rate'],
        fragGzip,
      );
      downloadedFrags.set(i, fragMeta || { size: 0, time: 0 });
      writeLog([
        fragMeta
          ? DL_EVENT.FRAG_DOWNLOAD_SUCCESS
          : DL_EVENT.FRAG_DOWNLOAD_FAILURE,
        frag.idx,
      ]);

      if (unmutedFrag && !unmutedFrag.sameFormat) {
        fragMeta = await downloadFrag(
          args.downloader,
          unmutedFrag.url,
          getPath.fragUnmuted(fragPath),
          args['limit-rate'],
          unmutedFrag.gzip,
        );
        writeLog([
          fragMeta
            ? DL_EVENT.FRAG_DOWNLOAD_UNMUTED_SUCCESS
            : DL_EVENT.FRAG_DOWNLOAD_UNMUTED_FAILURE,
          frag.idx,
        ]);
      }

      showProgress(downloadedFrags, fragsCount);
    }
    process.stdout.write('\n');

    if (liveVideoStatus === LIVE_VIDEO_STATUS.FINALIZED) break;
  }

  const dir = await readOutputDir(outputPath);
  const existingFrags = getExistingFrags(frags, outputPath, dir);
  writeLog([DL_EVENT.FRAGS_EXISTING, existingFrags.length]);

  await processUnmutedFrags(existingFrags, outputPath, dir, writeLog);

  const retCode = await mergeFrags(
    args['merge-method'],
    existingFrags,
    outputPath,
    args['keep-fragments'],
  );
  writeLog([
    retCode ? DL_EVENT.MERGE_FRAGS_FAILURE : DL_EVENT.MERGE_FRAGS_SUCCESS,
  ]);

  await showStats(logPath);
  if (!args['keep-fragments']) await fsp.unlink(logPath);
};
