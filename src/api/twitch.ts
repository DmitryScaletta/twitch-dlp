import { fetchGql } from '../utils/fetchGql.ts';
import { fetchText } from '../utils/fetchText.ts';

type VideoAccessTokenResponse = {
  value: string;
  signature: string;
};

export const getAccessToken = (type: 'video' | 'stream', id: string) => {
  const PARAM_NAMES = {
    video: 'id',
    stream: 'channelName',
  };
  const query = `{
    ${type}PlaybackAccessToken(
      ${PARAM_NAMES[type]}: "${id}"
      params: {
        platform: "web"
        playerBackend: "mediaplayer"
        playerType: "site"
      }
    ) {
      value
      signature
    }
  }`;
  return fetchGql<VideoAccessTokenResponse>(
    { query },
    `${type}PlaybackAccessToken`,
    `${type} access token`,
  );
};

export type StreamMetadataResponse = {
  id: string;
  primaryColorHex: string | null;
  isPartner: boolean;
  profileImageURL: string;
  channel: { id: string; chanlets: null; __typename: 'Channel' };
  lastBroadcast: {
    id: string | null;
    title: string | null;
    __typename: 'Broadcast';
  };
  stream: {
    id: string;
    type: 'live';
    createdAt: string;
    game: {
      id: string;
      slug: string;
      name: string;
      __typename: 'Game';
    } | null;
    __typename: 'Stream';
  } | null;
  __typename: 'User';
};

export const getStreamMetadata = (channelLogin: string) =>
  fetchGql<StreamMetadataResponse>(
    {
      operationName: 'StreamMetadata',
      variables: {
        channelLogin: channelLogin,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            '252a46e3f5b1ddc431b396e688331d8d020daec27079893ac7d4e6db759a7402',
        },
      },
    },
    'user',
    'stream metadata',
  );

export type VideoMetadataResponse = {
  id: string;
  title: string;
  description: null;
  previewThumbnailURL: string;
  createdAt: string;
  viewCount: number;
  publishedAt: string;
  lengthSeconds: number;
  broadcastType: 'ARCHIVE' | 'HIGHLIGHT';
  owner: {
    id: string;
    login: string;
    displayName: string;
    __typename: 'User';
  };
  game: {
    id: string;
    slug: string;
    boxArtURL: string;
    name: string;
    displayName: string;
    __typename: 'Game';
  } | null;
  __typename: 'Video';
};

export const getVideoMetadata = (videoId: string) =>
  fetchGql<VideoMetadataResponse>(
    {
      operationName: 'VideoMetadata',
      variables: {
        channelLogin: '',
        videoID: videoId,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            '45111672eea2e507f8ba44d101a61862f9c56b11dee09a15634cb75cb9b9084d',
        },
      },
    },
    'video',
    'video metadata',
  );

type BroadcastResponse = {
  id: string;
  stream: {
    id: string;
    archiveVideo: { id: string; __typename: 'Video' } | null;
    __typename: 'Stream';
  } | null;
  __typename: 'User';
};

export const getBroadcast = (channelId: string) =>
  fetchGql<BroadcastResponse>(
    {
      operationName: 'FFZ_BroadcastID',
      variables: {
        id: channelId,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            'cc89dfe8fcfe71235313b05b34799eaa519d162ebf85faf0c51d17c274614f0f',
        },
      },
    },
    'user',
    'broadcast id',
  );

export const getManifest = (
  videoId: string,
  accessToken: VideoAccessTokenResponse,
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
