import * as api from '../api/twitch.ts';
import { LIVE_VIDEO_STATUS } from '../constants.ts';
import type { Frag, LiveVideoMeta, LiveVideoStatus } from '../types.ts';

// To be able to download full vod we need to wait about 5-10 minutes after the end of the stream
const WAIT_AFTER_STREAM_ENDS_SECONDS = 8 * 60;

let lastLiveTimestamp = Date.now();

const getIsVideoLive = (thumbUrl: string) =>
  /\/404_processing_[^.?#]+\.png/.test(thumbUrl);

const getSecondsAfterStreamEnded = (videoMeta: api.VideoMetadata) => {
  const started = new Date(videoMeta.publishedAt);
  const ended = new Date(started.getTime() + videoMeta.lengthSeconds * 1000);
  return Math.floor((Date.now() - ended.getTime()) / 1000);
};

const checkStatusAfterStreamEnded = (
  secondsAfterEnd: number,
  frags: Frag[],
) => {
  // assume that a video is finalized if last frag duration differs from pre last 9 frags
  if (frags.length > 10) {
    const [lastFrag, ...preLast9Frags] = frags.slice(-10).reverse();
    const duration = preLast9Frags[0].duration;
    if (
      preLast9Frags.every((f) => f.duration === duration) &&
      duration !== lastFrag.duration
    ) {
      return LIVE_VIDEO_STATUS.FINALIZED;
    }
  }

  return secondsAfterEnd - WAIT_AFTER_STREAM_ENDS_SECONDS > 0
    ? LIVE_VIDEO_STATUS.FINALIZED
    : LIVE_VIDEO_STATUS.OFFLINE;
};

export const getLiveVideoStatus = async (
  { videoId, streamId, channelLogin }: LiveVideoMeta,
  frags: Frag[],
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
      return checkStatusAfterStreamEnded(secondsAfterEnd, frags);
    }
  }

  if (!videoId || !videoMeta) {
    const streamMeta = await api.getStreamMetadata(channelLogin);

    if (streamMeta?.stream?.id === streamId) {
      lastLiveTimestamp = Date.now();
      return LIVE_VIDEO_STATUS.ONLINE;
    }

    const secondsAfterEnd = (Date.now() - lastLiveTimestamp) / 1000;
    return checkStatusAfterStreamEnded(secondsAfterEnd, frags);
  }

  throw new Error('Cannot determine stream status');
};
