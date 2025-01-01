import type * as api from '../api/twitch.ts';
import type { VideoInfo } from '../types.ts';

export const getVideoInfo = (video: api.VideoMetadataResponse): VideoInfo => ({
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
