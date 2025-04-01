import {
  getQueryFfzBroadcastId,
  getQueryPlaybackAccessToken,
  getQueryStreamMetadata,
  getQueryVideoMetadata,
  gqlRequest,
  type FfzBroadcastIdUser,
  type PlaybackAccessTokenVideo,
  type StreamMetadataUser,
  type VideoMetadataVideo,
} from 'twitch-gql-queries';
import { fetchText } from '../utils/fetchText.ts';

const apiRequest = async <
  TQuery extends Parameters<typeof gqlRequest>[0][number],
  TResultKey extends string,
>(
  query: TQuery,
  resultKey: TResultKey,
  description = 'metadata',
) => {
  console.log(`Downloading ${description}`);
  try {
    const [res] = await gqlRequest([query]);
    return (res as any)?.data[resultKey] || null;
  } catch (e) {
    console.error(`Unable to download ${description}`);
    return null;
  }
};

export const getVideoAccessToken = (id: string) =>
  apiRequest(
    getQueryPlaybackAccessToken({
      isLive: false,
      login: '',
      isVod: true,
      vodID: id,
      playerType: 'site',
      platform: 'web',
    }),
    'videoPlaybackAccessToken',
    'video access token',
  );

export type StreamMetadata = StreamMetadataUser;

export const getStreamMetadata = (
  channelLogin: string,
): Promise<StreamMetadata | null> =>
  apiRequest(
    getQueryStreamMetadata({ channelLogin }),
    'user',
    'stream metadata',
  );

export type VideoMetadata = VideoMetadataVideo;

export const getVideoMetadata = (
  videoId: string,
): Promise<VideoMetadata | null> =>
  apiRequest(
    getQueryVideoMetadata({ channelLogin: '', videoID: videoId }),
    'video',
    'video metadata',
  );

export const getBroadcast = (
  channelId: string,
): Promise<FfzBroadcastIdUser | null> =>
  apiRequest(getQueryFfzBroadcastId({ id: channelId }), 'user', 'broadcast id');

export const getManifest = (
  videoId: string,
  accessToken: PlaybackAccessTokenVideo,
) => {
  const params = new URLSearchParams({
    allow_source: 'true',
    allow_audio_only: 'true',
    allow_spectre: 'true',
    player: 'twitchweb',
    playlist_include_framerate: 'true',
    sig: accessToken.signature,
    token: accessToken.value,
  });
  const url = `https://usher.ttvnw.net/vod/${videoId}.m3u8?${params}`;
  return fetchText(url, 'video manifest');
};
