import type {
  DOWNLOADERS,
  MERGE_METHODS,
  UNMUTE_POLICIES,
} from './constants.ts';

export type Downloader = (typeof DOWNLOADERS)[number];
export type MergeMethod = (typeof MERGE_METHODS)[number];
export type UnmutePolicy = (typeof UNMUTE_POLICIES)[number];

export type Frag = {
  /** Frag index in the original playlist */
  idx: number;
  /** Offset from the start of the video (sec) */
  offset: number;
  /** Frag duration (sec) */
  duration: string;
  /** Full frag url */
  url: string;
};
export type FragMetadata = {
  /** Frag size (bytes) */
  size: number;
  /** Time spent downloading a fragment */
  time: number;
};

export type DownloadSectionsArg = {
  startTime: number;
  endTime: number;
} | null;

export type BroadcastType = 'ARCHIVE' | 'HIGHLIGHT' | 'UPLOAD';

export type DownloadFormat = {
  format_id: string;
  width?: number | null;
  height?: number | null;
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
