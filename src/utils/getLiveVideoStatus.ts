import * as api from '../api/twitch.ts';
import { LIVE_VIDEO_STATUS } from '../constants.ts';
import type { LiveVideoStatus } from '../types.ts';

// To be able to download full vod we need to wait about 5-10 minutes after the end of the stream
const WAIT_AFTER_STREAM_ENDED_SECONDS = 8 * 60;

let lastLiveTimestamp = Date.now();

const getIsVideoLive = (thumbUrl: string) =>
  /\/404_processing_[^.?#]+\.png/.test(thumbUrl);

const getSecondsAfterStreamEnded = (videoMeta: api.VideoMetadata) => {
  const started = new Date(videoMeta.publishedAt);
  const ended = new Date(started.getTime() + videoMeta.lengthSeconds * 1000);
  return Math.floor((Date.now() - ended.getTime()) / 1000);
};

export const getLiveVideoStatus = async (
  videoId: string | null,
  streamId: string,
  channelLogin: string,
): Promise<LiveVideoStatus> => {
  let videoMeta: api.VideoMetadata | null = null;

  if (videoId) {
    videoMeta = await api.getVideoMetadata(videoId);
    if (videoMeta) {
      if (getIsVideoLive(videoMeta.previewThumbnailURL)) {
        lastLiveTimestamp = Date.now();
        return LIVE_VIDEO_STATUS.ONLINE;
      }
      const secondsAfterEnd = getSecondsAfterStreamEnded(videoMeta);
      return secondsAfterEnd - WAIT_AFTER_STREAM_ENDED_SECONDS > 0
        ? LIVE_VIDEO_STATUS.FINALIZED
        : LIVE_VIDEO_STATUS.OFFLINE;
    }
  }

  if (!videoId || !videoMeta) {
    const streamMeta = await api.getStreamMetadata(channelLogin);

    if (streamMeta?.stream?.id === streamId) {
      lastLiveTimestamp = Date.now();
      return LIVE_VIDEO_STATUS.ONLINE;
    }

    const secondsAfterEnd = (Date.now() - lastLiveTimestamp) / 1000;
    return secondsAfterEnd - WAIT_AFTER_STREAM_ENDED_SECONDS > 0
      ? LIVE_VIDEO_STATUS.FINALIZED
      : LIVE_VIDEO_STATUS.OFFLINE;
  }

  throw new Error('Cannot determine stream status');
};
