import fsp from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  DEFAULT_OUTPUT_TEMPLATE,
  NO_TRY_UNMUTE_MESSAGE,
} from '../constants.ts';
import { chalk } from '../lib/chalk.ts';
import * as hlsParser from '../lib/hlsParser.ts';
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
  FragMetadata,
  Frags,
  VideoInfo,
} from '../types.ts';
import { downloadFrag } from './downloadFrag.ts';
import { fetchText } from './fetchText.ts';
import { getDlFormat } from './getDlFormat.ts';
import { getExistingFrags } from './getExistingFrags.ts';
import { getFragsForDownloading } from './getFragsForDownloading.ts';
import { getPath } from './getPath.ts';
import { getTryUnmute } from './getTryUnmute.ts';
import { getUnmutedFrag, type UnmutedFrag } from './getUnmutedFrag.ts';
import { processUnmutedFrags } from './processUnmutedFrags.ts';
import { readOutputDir } from './readOutputDir.ts';
import { showFormats } from './showFormats.ts';
import { showProgress } from './showProgress.ts';

const WAIT_BETWEEN_CYCLES_SEC = 60;

const RETRY_MESSAGE = `Retry every ${WAIT_BETWEEN_CYCLES_SEC} second(s)`;

export const downloadVideo = async (
  formats: DownloadFormat[],
  videoInfo: VideoInfo,
  args: AppArgs,
) => {
  if (formats.length === 0) throw new Error('Cannot get video formats');

  if (args['list-formats']) {
    showFormats(formats);
    process.exit();
  }

  if (!(await isInstalled('ffmpeg'))) {
    throw new Error(
      'ffmpeg is not installed. Install it from https://ffmpeg.org/',
    );
  }

  const dlFormat = getDlFormat(formats, args.format);
  const outputPath = getPath.output(
    args.output || DEFAULT_OUTPUT_TEMPLATE,
    videoInfo,
  );
  let frags: Frags;
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

  while (true) {
    let playlistContent = await fetchText(playlistUrl, 'playlist');
    // workaround for some old muted highlights
    if (!playlistContent) {
      writeLog([DL_EVENT.FETCH_PLAYLIST_FAILURE]);
      const newPlaylistUrl = dlFormat.url.replace(/-muted-\w+(?=\.m3u8$)/, '');
      if (newPlaylistUrl !== playlistUrl) {
        playlistContent = await fetchText(playlistUrl, 'playlist (attempt #2)');
        if (playlistContent) {
          playlistUrl = newPlaylistUrl;
          writeLog([DL_EVENT.FETCH_PLAYLIST_OLD_MUTED_SUCCESS, playlistUrl]);
        } else {
          writeLog([DL_EVENT.FETCH_PLAYLIST_OLD_MUTED_FAILURE]);
        }
      }
    }
    if (!playlistContent && !args['live-from-start']) {
      throw new Error('Cannot download the playlist');
    }
    if (!playlistContent) {
      console.warn(
        `[live-from-start] Waiting for the playlist. ${RETRY_MESSAGE}`,
      );
      await sleep(WAIT_BETWEEN_CYCLES_SEC * 1000);
      continue;
    }

    const playlist = hlsParser.parse(
      playlistContent,
    ) as hlsParser.MediaPlaylist;
    writeLog([DL_EVENT.FETCH_PLAYLIST_SUCCESS]);

    frags = getFragsForDownloading(playlistUrl, playlist, args);
    writeLog(logFragsForDownloading(frags));

    await fsp.writeFile(getPath.playlist(outputPath), playlistContent);

    if (args['download-sections'] && downloadedFrags.size === frags.length) {
      break;
    }

    const hasNewFrags = frags.length > fragsCount;
    fragsCount = frags.length;
    if (!hasNewFrags && !playlist.endlist) {
      const message = `[live-from-start] ${chalk.green('VOD ONLINE')}: waiting for new fragments`;
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

      if (frag.url.includes('-unmuted')) {
        writeLog([DL_EVENT.FRAG_RENAME_UNMUTED, frag.idx]);
        frag.url = frag.url.replace('-unmuted', '-muted');
      }
      let unmutedFrag: UnmutedFrag | null = null;
      if (frag.url.includes('-muted')) {
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
        frags.isFMp4 ? (frag.isMap ? 'fmp4-map' : 'fmp4-media') : 'ts',
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
          frags.isFMp4 ? 'fmp4-media' : 'ts',
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

    if (playlist.endlist) break;
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
  if (!args['keep-fragments'] && !args['keep-log']) await fsp.unlink(logPath);
};
