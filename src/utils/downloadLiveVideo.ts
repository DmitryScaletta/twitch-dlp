import type { AppArgs } from '../main.ts';
import type { DownloadFormat, VideoInfo } from '../types.ts';
import * as api from '../api/twitch.ts';
import {
  getFullVodPath,
  getVideoFormats,
  getVideoFormatsByFullVodPath,
} from './getVideoFormats.ts';
import { downloadVideo } from './downloadVideo.ts';
import {
  getVideoInfoByStreamMeta,
  getVideoInfoByVideoMeta,
} from './getVideoInfo.ts';

// To be able to download full vod we need to wait about 5-10 minutes after the end of the stream
const WAIT_AFTER_STREAM_ENDED_SECONDS = 8 * 60;

export const downloadLiveVideo = async (
  streamMeta: api.StreamMetadataResponse,
  channelLogin: string,
  args: AppArgs,
) => {
  let formats: DownloadFormat[] = [];
  let videoInfo: VideoInfo;
  let videoId: string;

  if (!streamMeta.stream) return false; // make ts happy

  const broadcast = await api.getBroadcast(streamMeta.id);

  // public VOD
  if (broadcast?.stream?.archiveVideo) {
    videoId = broadcast.stream.archiveVideo.id;
    [formats, videoInfo] = await Promise.all([
      getVideoFormats(videoId),
      api
        .getVideoMetadata(videoId)
        .then((videoMeta) => getVideoInfoByVideoMeta(videoMeta!)),
    ]);
  }

  // private VOD
  if (!broadcast?.stream?.archiveVideo || formats.length === 0) {
    console.warn(
      "Couldn't find an archived video for the current broadcast. Trying to recover VOD url",
    );
    const startTimestamp =
      new Date(streamMeta.stream.createdAt).getTime() / 1000;
    const vodPath = `${channelLogin}_${streamMeta.stream.id}_${startTimestamp}`;
    formats = await getVideoFormatsByFullVodPath(getFullVodPath(vodPath));
    videoInfo = getVideoInfoByStreamMeta(streamMeta, channelLogin);
  }

  const streamId = broadcast?.stream?.id;
  let lastLiveTimestamp = Date.now();
  const getIsVodLive = (videoMeta: api.VideoMetadataResponse) =>
    /\/404_processing_[^.?#]+\.png/.test(videoMeta.previewThumbnailURL);
  const getSecondsAfterStreamEnded = (videoMeta: api.VideoMetadataResponse) => {
    const started = new Date(videoMeta.publishedAt);
    const ended = new Date(started.getTime() + videoMeta.lengthSeconds * 1000);
    return Math.floor((Date.now() - ended.getTime()) / 1000);
  };
  const getIsLive = async () => {
    let video;
    if (videoId) {
      video = await api.getVideoMetadata(videoId);
      const isLive = !video || getIsVodLive(video);
      if (isLive) return true;
      const secondsAfterEnd = getSecondsAfterStreamEnded(video!);
      return WAIT_AFTER_STREAM_ENDED_SECONDS - secondsAfterEnd > 0;
    }
    if (!videoId || !video) {
      const broadcast = await api.getBroadcast(streamMeta.id);
      if (!broadcast?.stream || broadcast.stream.id !== streamId) {
        const secondsAfterEnd = (Date.now() - lastLiveTimestamp) / 1000;
        return WAIT_AFTER_STREAM_ENDED_SECONDS - secondsAfterEnd > 0;
      } else {
        lastLiveTimestamp = Date.now();
        return true;
      }
    }
    return false;
  };

  if (formats.length === 0) {
    console.warn("Couldn't find VOD url");
    return false;
  }

  await downloadVideo(formats, videoInfo!, getIsLive, args);
  return true;
};
