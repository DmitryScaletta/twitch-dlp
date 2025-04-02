import * as api from '../api/twitch.ts';

// To be able to download full vod we need to wait about 5-10 minutes after the end of the stream
const WAIT_AFTER_STREAM_ENDED_SECONDS = 8 * 60;

let lastLiveTimestamp = Date.now();

const getIsVodLive = (thumbUrl: string) =>
  /\/404_processing_[^.?#]+\.png/.test(thumbUrl);

const getSecondsAfterStreamEnded = (videoMeta: api.VideoMetadata) => {
  const started = new Date(videoMeta.publishedAt);
  const ended = new Date(started.getTime() + videoMeta.lengthSeconds * 1000);
  return Math.floor((Date.now() - ended.getTime()) / 1000);
};

export const getIsStreamFinalized = async (
  videoId: string | null,
  streamId: string,
) => {
  let videoMeta: api.VideoMetadata | null = null;

  if (videoId) {
    videoMeta = await api.getVideoMetadata(videoId);
    if (videoMeta) {
      if (getIsVodLive(videoMeta.previewThumbnailURL)) {
        lastLiveTimestamp = Date.now();
        return false;
      }
      const secondsAfterEnd = getSecondsAfterStreamEnded(videoMeta);
      return secondsAfterEnd - WAIT_AFTER_STREAM_ENDED_SECONDS > 0;
    }
  }

  if (!videoId || !videoMeta) {
    const broadcast = await api.getBroadcast(streamId!);

    if (broadcast?.stream?.id === streamId) {
      lastLiveTimestamp = Date.now();
      return false;
    }

    const secondsAfterEnd = (Date.now() - lastLiveTimestamp) / 1000;
    return secondsAfterEnd - WAIT_AFTER_STREAM_ENDED_SECONDS > 0;
  }

  throw new Error();
};
