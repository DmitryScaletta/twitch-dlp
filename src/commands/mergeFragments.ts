import fsp from 'node:fs/promises';
import path from 'node:path';
import { NO_TRY_UNMUTE_MESSAGE, UNMUTE } from '../constants.ts';
import * as hlsParser from '../lib/hlsParser.ts';
import { mergeFrags } from '../merge/index.ts';
import {
  createLogger,
  DL_EVENT,
  getFragsInfo,
  getInitPayload,
  getLog,
  logFragsForDownloading,
  logUnmuteResult,
  showStats,
  type DlEvent,
} from '../stats.ts';
import type { AppArgs, DownloadFormat, Frags } from '../types.ts';
import { downloadFrag } from '../utils/downloadFrag.ts';
import { getExistingFrags } from '../utils/getExistingFrags.ts';
import { getFragsForDownloading } from '../utils/getFragsForDownloading.ts';
import { getPath } from '../utils/getPath.ts';
import { getTryUnmute } from '../utils/getTryUnmute.ts';
import { getUnmutedFrag } from '../utils/getUnmutedFrag.ts';
import { processUnmutedFrags } from '../utils/processUnmutedFrags.ts';
import { readOutputDir } from '../utils/readOutputDir.ts';

const tryUnmuteFrags = async (
  outputPath: string,
  log: DlEvent[],
  frags: Frags,
  formats: DownloadFormat[],
  args: AppArgs,
  writeLog: ReturnType<typeof createLogger>,
) => {
  const fragsInfo = getFragsInfo(log);

  for (const frag of frags) {
    const fragN = frag.idx + 1;
    const info = fragsInfo[frag.idx];
    if (!info || !info.muted || info.replaceAudioSuccess) continue;
    if (info.unmuteSameFormat && info.dlSuccess) continue;

    const unmutedFrag = await getUnmutedFrag(
      args.downloader,
      args.unmute,
      frag.url,
      formats,
    );
    writeLog(logUnmuteResult(unmutedFrag, frag.idx));
    if (!unmutedFrag) {
      console.log(`[unmute] Frag${fragN}: cannot unmute`);
      continue;
    }
    const fragPath = getPath.frag(outputPath, fragN);
    if (unmutedFrag.sameFormat) {
      const fragPathTmp = `${fragPath}.tmp`;
      await fsp.rename(fragPath, fragPathTmp);
      const fragMeta = await downloadFrag(
        args.downloader,
        unmutedFrag.url,
        fragPath,
        args['limit-rate'],
        unmutedFrag.gzip,
        frags.isFMp4 ? 'fmp4-media' : 'ts',
      );
      if (fragMeta) {
        await fsp.unlink(fragPathTmp);
        console.log(`[unmute] Frag${fragN}: successfully unmuted`);
      } else {
        await fsp.rename(fragPathTmp, fragPath);
        console.log(`[unmute] Frag${fragN}: cannot download unmuted fragment`);
      }
      writeLog([
        fragMeta
          ? DL_EVENT.FRAG_DOWNLOAD_SUCCESS
          : DL_EVENT.FRAG_DOWNLOAD_FAILURE,
        frag.idx,
      ]);
    } else {
      const unmutedFragPath = getPath.fragUnmuted(fragPath);
      const fragMeta = await downloadFrag(
        args.downloader,
        unmutedFrag.url,
        unmutedFragPath,
        args['limit-rate'],
        unmutedFrag.gzip,
        frags.isFMp4 ? 'fmp4-media' : 'ts',
      );
      if (fragMeta) {
        console.log(`[unmute] Frag${fragN}: successfully unmuted`);
      } else {
        console.log(`[unmute] Frag${fragN}: cannot download unmuted fragment`);
      }
      writeLog([
        fragMeta
          ? DL_EVENT.FRAG_DOWNLOAD_UNMUTED_SUCCESS
          : DL_EVENT.FRAG_DOWNLOAD_UNMUTED_FAILURE,
        frag.idx,
      ]);
    }
  }
};

export const mergeFragments = async (outputPath: string, args: AppArgs) => {
  outputPath = path.resolve(outputPath);
  const [playlistContent, dir] = await Promise.all([
    fsp.readFile(getPath.playlist(outputPath), 'utf8'),
    readOutputDir(outputPath),
  ]);
  const logPath = getPath.log(outputPath);
  const log = await getLog(logPath);
  const writeLog = createLogger(logPath);
  const dlInfo = getInitPayload(log || []);
  const playlistUrl = dlInfo?.playlistUrl || '';
  const playlist = hlsParser.parse(playlistContent) as hlsParser.MediaPlaylist;
  const allFrags = getFragsForDownloading(playlistUrl, playlist, args);
  const frags = getExistingFrags(allFrags, outputPath, dir);

  if (log && dlInfo && args.unmute && args.unmute !== UNMUTE.OFF) {
    const { videoInfo, formats } = dlInfo;
    if (getTryUnmute(videoInfo)) {
      await tryUnmuteFrags(outputPath, log, frags, formats, args, writeLog);
    } else {
      console.warn(NO_TRY_UNMUTE_MESSAGE);
    }
  }

  writeLog(logFragsForDownloading(frags));

  await processUnmutedFrags(frags, outputPath, dir, writeLog);
  await mergeFrags(args['merge-method'], frags, outputPath, true);
  await showStats(logPath);
};
