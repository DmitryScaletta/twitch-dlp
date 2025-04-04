import fsp from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { LIVE_VIDEO_STATUS, RET_CODE } from '../constants.ts';
import { downloadFile } from '../downloaders/index.ts';
import { chalk } from '../lib/chalk.ts';
import { isInstalled } from '../lib/isInstalled.ts';
import { statsOrNull } from '../lib/statsOrNull.ts';
import type { AppArgs } from '../main.ts';
import { mergeFrags } from '../merge/index.ts';
import { createLogger, DL_EVENT, showStats } from '../stats.ts';
import type {
  Downloader,
  DownloadFormat,
  FragMetadata,
  LiveVideoStatus,
  VideoInfo,
} from '../types.ts';
import { fetchText } from './fetchText.ts';
import { getExistingFrags } from './getExistingFrags.ts';
import { getFragsForDownloading } from './getFragsForDownloading.ts';
import { getPath } from './getPath.ts';
import { getUnmutedFrag, type UnmutedFrag } from './getUnmutedFrag.ts';
import { processUnmutedFrags } from './processUnmutedFrags.ts';
import { readOutputDir } from './readOutputDir.ts';
import { showProgress } from './showProgress.ts';

const DEFAULT_OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s';
const WAIT_BETWEEN_CYCLES_SEC = 60;

const RETRY_MESSAGE = `Retry every ${WAIT_BETWEEN_CYCLES_SEC} second(s)`;

const downloadFrag = async (
  downloader: Downloader,
  url: string,
  destPath: string,
  limitRateArg?: string,
  gzip?: boolean,
) => {
  const destPathTmp = `${destPath}.part`;
  if (await statsOrNull(destPathTmp)) await fsp.unlink(destPathTmp);
  const startTime = Date.now();
  const retCode = await downloadFile(
    downloader,
    url,
    destPathTmp,
    limitRateArg,
    gzip,
  );
  const endTime = Date.now();
  if (retCode !== RET_CODE.OK) {
    try {
      await fsp.unlink(destPathTmp);
    } catch {}
    return null;
  }
  await fsp.rename(destPathTmp, destPath);
  const { size } = await fsp.stat(destPath);
  return { size, time: endTime - startTime };
};

const isVideoOlderThat24h = (videoInfo: VideoInfo) => {
  const videoDate = videoInfo.upload_date || videoInfo.release_date;
  if (!videoDate) return null;
  const now = Date.now();
  const videoDateMs = new Date(videoDate).getTime();
  return now - videoDateMs > 24 * 60 * 60 * 1000;
};

export const downloadVideo = async (
  formats: DownloadFormat[],
  videoInfo: VideoInfo,
  args: AppArgs,
  getLiveVideoStatus: (
    currentStreamId?: string,
  ) => LiveVideoStatus | Promise<LiveVideoStatus> = () =>
    LIVE_VIDEO_STATUS.FINALIZED,
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
      : formats.find((f) => f.format_id === args.format);
  if (!dlFormat) throw new Error('Wrong format');

  const outputPath = getPath.output(
    args.output || DEFAULT_OUTPUT_TEMPLATE,
    videoInfo,
  );
  let liveVideoStatus: LiveVideoStatus;
  let frags;
  let fragsCount = 0;
  let playlistUrl = dlFormat.url;
  const downloadedFrags: FragMetadata[] = [];

  const logPath = getPath.log(outputPath);
  const writeLog = createLogger(logPath);

  writeLog([DL_EVENT.INIT, { args, formats, outputPath, playlistUrl }]);

  while (true) {
    let playlist;
    [playlist, liveVideoStatus] = await Promise.all([
      fetchText(playlistUrl, 'playlist'),
      getLiveVideoStatus(),
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

    frags = getFragsForDownloading(
      playlistUrl,
      playlist,
      args['download-sections'],
    );
    writeLog([DL_EVENT.FRAGS_FOR_DOWNLOADING, frags]);

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
        writeLog([DL_EVENT.FRAG_ALREADY_EXISTS, frag.idx]);
        if (!downloadedFrags[i]) {
          downloadedFrags[i] = { size: fragStats.size, time: 0 };
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
        if (!isVideoOlderThat24h(videoInfo)) {
          unmutedFrag = await getUnmutedFrag(
            args.downloader,
            args.unmute,
            frag.url,
            formats,
          );
          writeLog([DL_EVENT.FRAG_UNMUTE_RESULT, frag.idx, unmutedFrag]);
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
      downloadedFrags.push(fragMeta || { size: 0, time: 0 });
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

  await processUnmutedFrags(
    existingFrags,
    outputPath,
    dir,
    (frag) => writeLog([DL_EVENT.FRAG_REPLACE_AUDIO_SUCCESS, frag.idx]),
    (frag) => writeLog([DL_EVENT.FRAG_REPLACE_AUDIO_FAILURE, frag.idx]),
  );

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
