import type { AppArgs } from '../main.ts';
import type { DownloadFormat, VideoInfo } from '../types.ts';
import * as api from '../api/twitch.ts';
import {
  getFullVodPath,
  getVideoFormats,
  getVideoFormatsByFullVodPath,
} from './getVideoFormats.ts';
import { downloadVideo } from './downloadVideo.ts';

export const downloadVideoFromStart = async (
  channel: api.StreamMetadataResponse,
  channelLogin: string,
  args: AppArgs,
) => {
  const WAIT_AFTER_STREAM_ENDED_SECONDS = 8 * 60;

  let formats: DownloadFormat[] = [];
  let videoInfo: VideoInfo;
  let videoId: string;

  if (!channel.stream) return false; // make ts happy

  const broadcast = await api.getBroadcast(channel.id);

  // public VOD
  if (broadcast?.stream?.archiveVideo) {
    videoId = broadcast.stream.archiveVideo.id;
    // @ts-expect-error
    [formats, videoInfo] = await Promise.all([
      getVideoFormats(videoId),
      // @ts-expect-error
      api.getVideoMetadata(videoId).then(getVideoInfo),
    ]);
  }

  // private VOD
  if (!broadcast?.stream?.archiveVideo || formats.length === 0) {
    console.warn(
      "Couldn't find an archived video for the current broadcast. Trying to recover VOD url",
    );
    let contentMetadata: api.ContentMetadataResponse | null;
    const startTimestamp = new Date(channel.stream.createdAt).getTime() / 1000;
    const vodPath = `${channelLogin}_${channel.stream.id}_${startTimestamp}`;
    [formats, contentMetadata] = await Promise.all([
      getVideoFormatsByFullVodPath(getFullVodPath(vodPath)),
      api.getContentMetadata(channelLogin),
    ]);
    videoInfo = {
      id: `v${channel.stream.id}`,
      title: contentMetadata?.broadcastSettings.title || 'Untitled Broadcast',
      uploader: channelLogin,
      uploader_id: channelLogin,
      upload_date: channel.stream.createdAt,
      release_date: channel.stream.createdAt,
      ext: 'mp4',
    };
  }

  // To be able to download full vod we need to wait about 5 minutes after the end of the stream
  const streamId = broadcast?.stream?.id;
  let lastLiveTimestamp = Date.now();
  const getIsVodLive = (video: api.VideoMetadataResponse) =>
    /\/404_processing_[^.?#]+\.png/.test(video.previewThumbnailURL);
  const getSecondsAfterStreamEnded = (video: api.VideoMetadataResponse) => {
    const started = new Date(video.publishedAt);
    const ended = new Date(started.getTime() + video.lengthSeconds * 1000);
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
      const broadcast = await api.getBroadcast(channel.id);
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
