import {
  FFZRecentBroadcastsQuery,
  getQuery,
  gqlRequest,
  PlaybackAccessTokenQuery,
  ShareClipRenderStatusQuery,
  StreamMetadataQuery,
  VideoMetadataQuery,
  type FFZRecentBroadcastsData,
  type PlaybackAccessTokenData,
  type ShareClipRenderStatusData,
  type StreamMetadataData,
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
  } catch {
    console.error(`Unable to download ${description}`);
    return null;
  }
};

export const getVideoAccessToken = (id: string) =>
  apiRequest(
    getQuery(PlaybackAccessTokenQuery, {
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

export type StreamMetadata = NonNullable<StreamMetadataData['user']>;

export const getStreamMetadata = (
  channelLogin: string,
): Promise<StreamMetadata | null> =>
  apiRequest(
    getQuery(StreamMetadataQuery, { channelLogin }),
    'user',
    'stream metadata',
  );

export type VideoMetadata = VideoMetadataVideo;

export const getVideoMetadata = (
  videoId: string,
): Promise<VideoMetadata | null> =>
  apiRequest(
    getQuery(VideoMetadataQuery, { channelLogin: '', videoID: videoId }),
    'video',
    'video metadata',
  );

export type ClipMetadata = NonNullable<ShareClipRenderStatusData['clip']>;

export const getClipMetadata = (slug: string): Promise<ClipMetadata | null> =>
  apiRequest(
    getQuery(ShareClipRenderStatusQuery, { slug }),
    'clip',
    'clip metadata',
  );

type RecentArchiveBroadcasts = NonNullable<FFZRecentBroadcastsData['user']>;

export const getRecentArchiveBroadcasts = (
  channelId: string,
): Promise<RecentArchiveBroadcasts | null> =>
  apiRequest(
    getQuery(FFZRecentBroadcastsQuery, {
      id: channelId,
      type: 'ARCHIVE',
      sort: 'TIME',
      limit: 1,
    }),
    'user',
    'recent broadcast',
  );

export const getManifest = (
  videoId: string,
  accessToken: NonNullable<PlaybackAccessTokenData['videoPlaybackAccessToken']>,
) => {
  const params = new URLSearchParams({
    allow_source: 'true',
    allow_audio_only: 'true',
    allow_spectre: 'true',
    include_unavailable: 'true',
    player: 'twitchweb',
    playlist_include_framerate: 'true',
    sig: accessToken.signature,
    supported_codecs: 'av1,h265,h264',
    token: accessToken.value,
  });
  const url = `https://usher.ttvnw.net/vod/${videoId}.m3u8?${params}`;
  return fetchText(url, 'video manifest');
};
