import fsp from 'node:fs/promises';
import { groupBy } from './lib/groupBy.ts';
import type { AppArgs } from './main.ts';
import type {
  DownloadFormat,
  Frag,
  LiveVideoStatus,
  VideoInfo,
} from './types.ts';
import type { UnmutedFrag } from './utils/getUnmutedFrag.ts';

export const DL_EVENT = {
  INIT: 'INIT',
  FETCH_PLAYLIST_SUCCESS: 'FETCH_PLAYLIST_SUCCESS',
  FETCH_PLAYLIST_FAILURE: 'FETCH_PLAYLIST_FAILURE',
  FETCH_PLAYLIST_OLD_MUTED_SUCCESS: 'FETCH_PLAYLIST_OLD_MUTED_SUCCESS',
  FETCH_PLAYLIST_OLD_MUTED_FAILURE: 'FETCH_PLAYLIST_OLD_MUTED_FAILURE',
  LIVE_VIDEO_STATUS: 'LIVE_VIDEO_STATUS',
  FRAGS_FOR_DOWNLOADING: 'FRAGS_FOR_DOWNLOADING',
  FRAGS_EXISTING: 'FRAGS_EXISTING',
  FRAG_ALREADY_EXISTS: 'FRAG_ALREADY_EXISTS',
  FRAG_RENAME_UNMUTED: 'FRAG_RENAME_UNMUTED',
  FRAG_MUTED: 'FRAG_MUTED',
  FRAG_UNMUTE_SUCCESS: 'FRAG_UNMUTE_SUCCESS',
  FRAG_UNMUTE_FAILURE: 'FRAG_UNMUTE_FAILURE',
  FRAG_DOWNLOAD_SUCCESS: 'FRAG_DOWNLOAD_SUCCESS',
  FRAG_DOWNLOAD_FAILURE: 'FRAG_DOWNLOAD_FAILURE',
  FRAG_DOWNLOAD_UNMUTED_SUCCESS: 'FRAG_DOWNLOAD_UNMUTED_SUCCESS',
  FRAG_DOWNLOAD_UNMUTED_FAILURE: 'FRAG_DOWNLOAD_UNMUTED_FAILURE',
  FRAG_REPLACE_AUDIO_SUCCESS: 'FRAG_REPLACE_AUDIO_SUCCESS',
  FRAG_REPLACE_AUDIO_FAILURE: 'FRAG_REPLACE_AUDIO_FAILURE',
  MERGE_FRAGS_SUCCESS: 'MERGE_FRAGS_SUCCESS',
  MERGE_FRAGS_FAILURE: 'MERGE_FRAGS_FAILURE',
} as const;

type EvNames = typeof DL_EVENT;

export type InitPayload = {
  args: AppArgs;
  formats: DownloadFormat[];
  outputPath: string;
  playlistUrl: string;
  videoInfo: VideoInfo;
};

// prettier-ignore
export type DlEvent =
  | [name: EvNames['INIT'], payload: InitPayload]
  | [name: EvNames['FETCH_PLAYLIST_SUCCESS']]
  | [name: EvNames['FETCH_PLAYLIST_FAILURE']]
  | [name: EvNames['FETCH_PLAYLIST_OLD_MUTED_SUCCESS'], newPlaylistUrl: string]
  | [name: EvNames['FETCH_PLAYLIST_OLD_MUTED_FAILURE']]
  | [name: EvNames['LIVE_VIDEO_STATUS'], liveVideoStatus: LiveVideoStatus]
  | [name: EvNames['FRAGS_FOR_DOWNLOADING'], startIdx: number, endIdx: number]
  | [name: EvNames['FRAGS_EXISTING'], fragCount: number]
  | [name: EvNames['FRAG_RENAME_UNMUTED'], fragIdx: number]
  | [name: EvNames['FRAG_MUTED'], fragIdx: number]
  | [name: EvNames['FRAG_UNMUTE_SUCCESS'], fragIdx: number, sameFormat: boolean, gzip: boolean, url: string]
  | [name: EvNames['FRAG_UNMUTE_FAILURE'], fragIdx: number]
  | [name: EvNames['FRAG_DOWNLOAD_SUCCESS'], fragIdx: number]
  | [name: EvNames['FRAG_DOWNLOAD_FAILURE'], fragIdx: number]
  | [name: EvNames['FRAG_DOWNLOAD_UNMUTED_SUCCESS'], fragIdx: number]
  | [name: EvNames['FRAG_DOWNLOAD_UNMUTED_FAILURE'], fragIdx: number]
  | [name: EvNames['FRAG_REPLACE_AUDIO_SUCCESS'], fragIdx: number]
  | [name: EvNames['FRAG_REPLACE_AUDIO_FAILURE'], fragIdx: number]
  | [name: EvNames['MERGE_FRAGS_SUCCESS']]
  | [name: EvNames['MERGE_FRAGS_FAILURE']];

export const createLogger = (logPath: string) => (event: DlEvent) => {
  const line = event.map((v) => JSON.stringify(v)).join('\t');
  return fsp.appendFile(logPath, `${line}\n`);
};

const nameEq = (name: keyof EvNames) => (event: DlEvent) => event[0] === name;

export const getLog = async (logPath: string) => {
  try {
    const logContent = await fsp.readFile(logPath, 'utf8');
    return logContent
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t').map((v) => JSON.parse(v)) as DlEvent);
  } catch {
    return null;
  }
};

export const logUnmuteResult = (
  unmuteResult: UnmutedFrag | null,
  fragIdx: number,
): DlEvent => {
  if (unmuteResult) {
    const { sameFormat, gzip, url } = unmuteResult;
    return [DL_EVENT.FRAG_UNMUTE_SUCCESS, fragIdx, sameFormat, gzip, url];
  } else {
    return [DL_EVENT.FRAG_UNMUTE_FAILURE, fragIdx];
  }
};

export const logFragsForDownloading = (frags: Frag[]): DlEvent => [
  DL_EVENT.FRAGS_FOR_DOWNLOADING,
  frags[0]?.idx || 0,
  frags[frags.length - 1]?.idx || 0,
];

type FragInfo = {
  muted: boolean | null;
  unmuteSuccess: boolean | null;
  unmuteSameFormat: boolean | null;
  dlSuccess: boolean | null;
  dlUnmutedSuccess: boolean | null;
  replaceAudioSuccess: boolean | null;
};

export const getFragsInfo = (log: DlEvent[]) => {
  const fragsInfo: Record<string | number, FragInfo> = {};
  const fragsGroupedByIdx = groupBy(
    log.filter(([name]) => name.startsWith('FRAG_')),
    (e) => e[1] as number,
  );
  for (const [fragIdx, events] of Object.entries(fragsGroupedByIdx)) {
    const fragInfo: FragInfo = {
      muted: null,
      unmuteSuccess: null,
      unmuteSameFormat: null,
      dlSuccess: null,
      dlUnmutedSuccess: null,
      replaceAudioSuccess: null,
    };
    fragsInfo[fragIdx] = fragInfo;
    if (!events) continue;
    fragInfo.muted = !!events.findLast(nameEq(DL_EVENT.FRAG_MUTED));
    const unmuteSuccess = events.findLast(nameEq(DL_EVENT.FRAG_UNMUTE_SUCCESS));
    fragInfo.unmuteSuccess = !!unmuteSuccess;
    fragInfo.unmuteSameFormat =
      (unmuteSuccess?.[2] as boolean | undefined) || null;
    fragInfo.dlSuccess = !!events.findLast(
      nameEq(DL_EVENT.FRAG_DOWNLOAD_SUCCESS),
    );
    fragInfo.dlUnmutedSuccess = !!events.findLast(
      nameEq(DL_EVENT.FRAG_DOWNLOAD_UNMUTED_SUCCESS),
    );
    fragInfo.replaceAudioSuccess = !!events.findLast(
      nameEq(DL_EVENT.FRAG_REPLACE_AUDIO_SUCCESS),
    );
  }
  return fragsInfo;
};

export const getInitPayload = (log: DlEvent[]) =>
  (log.findLast(nameEq(DL_EVENT.INIT))?.[1] as InitPayload | undefined) || null;

export const showStats = async (logPath: string) => {
  const log = await getLog(logPath);
  if (!log) {
    console.error('[stats] Cannot read log file');
    return;
  }

  const ffd = log.findLast(nameEq(DL_EVENT.FRAGS_FOR_DOWNLOADING));
  if (!ffd) return;
  const [, fragStartIdx, fragEndIdx] = ffd as [string, number, number];
  if (fragStartIdx === 0 && fragEndIdx === 0) return;
  const fragsInfo = getFragsInfo(log);

  let downloaded = 0;
  let muted = 0;
  let unmutedSameFormat = 0;
  let unmutedReplacedAudio = 0;
  for (let i = fragStartIdx; i <= fragEndIdx; i += 1) {
    const fragInfo = fragsInfo[i];
    if (!fragInfo) continue;
    if (fragInfo.dlSuccess) downloaded += 1;
    if (fragInfo.muted) muted += 1;
    if (!fragInfo.unmuteSuccess) continue;
    if (!fragInfo.dlSuccess) continue;
    if (fragInfo.unmuteSameFormat) {
      unmutedSameFormat += 1;
    } else if (fragInfo.dlUnmutedSuccess && fragInfo.replaceAudioSuccess) {
      unmutedReplacedAudio += 1;
    }
  }

  const stats = {
    Total: fragEndIdx - fragStartIdx + 1,
    Downloaded: downloaded,
    Muted: muted,
  };
  const statsUnmuted = {
    'Unmuted total': unmutedSameFormat + unmutedReplacedAudio,
    'Unmuted (same format)': unmutedSameFormat,
    'Unmuted (replaced audio)': unmutedReplacedAudio,
  };
  console.log('[stats] Fragments');
  console.table(muted > 0 ? { ...stats, ...statsUnmuted } : stats);
};
