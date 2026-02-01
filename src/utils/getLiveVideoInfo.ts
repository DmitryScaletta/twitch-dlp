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
  const broadcast = broadcasts?.videos?.edges[0]?.node;

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

  // StreamMetadata response available after ~7-12 sec after a stream is started
  // FfzRecentBroadcasts response available after ~7-40 sec after a VOD is published
  // A VOD itself is published ~6-20 sec after a stream is started
  // A delay for FfzRecentBroadcasts and FilterableVideoTowerVideos (type: ARCHIVE) is identical

  // | ------> | ---------> | ---------------> |
  // ^         ^            ^                  ^
  // stream    VOD          stream response    VOD response
  // started   published    available          available

  // So wait at least 90 sec before trying to recover the playlist
  const checkPrivateVod = Date.now() - startTimestampMs > 90_000;

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
