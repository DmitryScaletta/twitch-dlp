import type { VideoInfo } from '../types.ts';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const getTryUnmute = (videoInfo: VideoInfo) => {
  const videoDate = videoInfo.upload_date || videoInfo.release_date;
  if (!videoDate) return null;
  const videoDateMs = new Date(videoDate).getTime();
  return Date.now() - videoDateMs > ONE_WEEK_MS;
};
