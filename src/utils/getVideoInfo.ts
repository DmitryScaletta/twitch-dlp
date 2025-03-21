import type * as api from '../api/twitch.ts';
import type { VideoInfo } from '../types.ts';

const DEFAULT_TITLE = 'Untitled Broadcast';

export const getVideoInfoByVideoMeta = (
  videoMeta: api.VideoMetadataResponse,
): VideoInfo => ({
  id: `v${videoMeta.id}`,
  title: videoMeta.title || DEFAULT_TITLE,
  description: videoMeta.description,
  duration: videoMeta.lengthSeconds,
  uploader: videoMeta.owner.displayName,
  uploader_id: videoMeta.owner.login,
  upload_date: videoMeta.createdAt,
  release_date: videoMeta.publishedAt,
  view_count: videoMeta.viewCount,
  ext: 'mp4',
});

export const getVideoInfoByStreamMeta = (
  streamMeta: api.StreamMetadata,
  channelLogin: string,
): VideoInfo => ({
  id: `v${streamMeta.lastBroadcast.id}`,
  title: streamMeta.lastBroadcast.title || DEFAULT_TITLE,
  description: null,
  duration: null,
  uploader: channelLogin,
  uploader_id: streamMeta.id,
  upload_date: streamMeta.stream!.createdAt,
  release_date: streamMeta.stream!.createdAt,
  view_count: null,
  ext: 'mp4',
});

export const getVideoInfoByVodPath = ({
  channelLogin,
  videoId,
  startTimestamp,
}: {
  channelLogin: string;
  videoId: string;
  startTimestamp: number;
}): VideoInfo => ({
  id: `v${videoId}`,
  title: `${channelLogin}_${startTimestamp}`,
  description: null,
  duration: null,
  uploader: channelLogin,
  uploader_id: null,
  upload_date: new Date(startTimestamp * 1000).toISOString(),
  release_date: new Date(startTimestamp * 1000).toISOString(),
  view_count: null,
  ext: 'mp4',
});
