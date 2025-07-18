import type { DOWNLOADERS, MERGE_METHODS } from './constants.ts';
import type { getArgs } from './main.ts';

export type Downloader = (typeof DOWNLOADERS)[number];
export type MergeMethod = (typeof MERGE_METHODS)[number];

export type RawArgs = ReturnType<typeof getArgs>;
export type AppArgs = Omit<
  RawArgs['values'],
  'download-sections' | 'retry-streams'
> & {
  downloader: Downloader;
  'download-sections': readonly [startTime: number, endTime: number] | null;
  'retry-streams': number | undefined;
  'merge-method': MergeMethod;
};

export type Frag = {
  /** Frag index in the original playlist */
  idx: number;
  /** Offset from the start of the video (sec) */
  offset: number;
  /** Frag duration (sec) */
  duration: number;
  /** Is it a frag from #EXT-X-MAP tag */
  isMap?: true;
  /** Full frag url */
  url: string;
};
export type Frags = Frag[] & { isFMp4: boolean };
export type FragMetadata = {
  /** Frag size (bytes) */
  size: number;
  /** Time spent downloading a fragment (ms) */
  time: number;
};

export type BroadcastType = 'ARCHIVE' | 'HIGHLIGHT' | 'UPLOAD';

export type DownloadFormat = {
  format_id: string;
  width?: number | null;
  height?: number | null;
  frameRate?: number | null;
  totalBitrate?: number | null;
  source: true | null;
  url: string;
};

export type VideoInfo = {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  uploader: string | null;
  uploader_id: string | null;
  upload_date: string | null;
  release_date: string | null;
  view_count: number | null;
  ext: 'mp4';
};
