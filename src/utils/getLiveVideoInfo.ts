import * as api from '../api/twitch.ts';
import type { DownloadFormat, VideoInfo } from '../types.ts';
import {
  getFullVodPath,
  getVideoFormats,
  getVideoFormatsByFullVodPath,
} from './getVideoFormats.ts';
import {
  getVideoInfoByStreamMeta,
  getVideoInfoByVideoMeta,
} from './getVideoInfo.ts';

export const getLiveVideoInfo = async (
  streamMeta: api.StreamMetadata,
  channelLogin: string,
) => {
  let formats: DownloadFormat[] = [];
  let videoInfo: VideoInfo | null = null;

  if (!streamMeta.stream) throw new Error(); // make ts happy

  const broadcasts = await api.getRecentArchiveBroadcasts(streamMeta.id);
  const broadcast = broadcasts?.videos.edges[0]?.node;

  const startTimestampMs = new Date(streamMeta.stream.createdAt).getTime();

  // public VOD
  if (
    broadcast &&
    startTimestampMs <= new Date(broadcast.createdAt).getTime()
  ) {
    let videoMeta: Awaited<ReturnType<typeof api.getVideoMetadata>>;
    [formats, videoMeta] = await Promise.all([
      getVideoFormats(broadcast.id),
      api.getVideoMetadata(broadcast.id),
    ]);
    if (videoMeta) videoInfo = getVideoInfoByVideoMeta(videoMeta);
  }

  // A VOD is published about 5-20 seconds after a stream starts
  // Wait at least 30 seconds before trying to recover the playlist
  const checkPrivateVod = startTimestampMs + 30_000 < Date.now();

  // private VOD
  if (checkPrivateVod && formats.length === 0) {
    console.warn('[live-from-start] Recovering the playlist');
    const startTimestamp = startTimestampMs / 1000;
    const vodPath = `${channelLogin}_${streamMeta.stream.id}_${startTimestamp}`;
    formats = await getVideoFormatsByFullVodPath(getFullVodPath(vodPath));
    videoInfo = getVideoInfoByStreamMeta(streamMeta, channelLogin);
  }

  if (formats.length === 0 || !videoInfo) return null;

  return { formats, videoInfo };
};
