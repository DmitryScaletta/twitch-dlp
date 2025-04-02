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
  let videoId: string | null = null;

  if (!streamMeta.stream) throw new Error(); // make ts happy

  const broadcast = await api.getBroadcast(streamMeta.id);

  // public VOD
  if (broadcast?.stream?.archiveVideo) {
    videoId = broadcast.stream.archiveVideo.id;
    let videoMeta: Awaited<ReturnType<typeof api.getVideoMetadata>>;
    [formats, videoMeta] = await Promise.all([
      getVideoFormats(videoId),
      api.getVideoMetadata(videoId),
    ]);
    if (videoMeta) videoInfo = getVideoInfoByVideoMeta(videoMeta);
  }

  // private VOD
  if (!broadcast?.stream?.archiveVideo || formats.length === 0) {
    console.warn(
      "Couldn't find an archived video for the broadcast. Trying to recover a VOD url",
    );
    const startTimestamp =
      new Date(streamMeta.stream.createdAt).getTime() / 1000;
    const vodPath = `${channelLogin}_${streamMeta.stream.id}_${startTimestamp}`;
    formats = await getVideoFormatsByFullVodPath(getFullVodPath(vodPath));
    videoInfo = getVideoInfoByStreamMeta(streamMeta, channelLogin);
  }

  if (formats.length === 0) {
    console.warn("Couldn't find a VOD url");
    return null;
  }

  if (!videoInfo) return null;

  return { formats, videoInfo, videoId };
};
