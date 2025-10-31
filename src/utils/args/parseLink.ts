import {
  CHANNEL_REGEX_EXACT,
  CLIP_REGEX_EXACT,
  VIDEO_REGEX_EXACT,
  type ChannelMatchGroups,
  type ClipMatchGroups,
  type VideoMatchGroups,
} from 'twitch-regex';

// https://regex101.com/r/tvGCMP/2
const VOD_PATH_REGEX =
  /^video:(?<vodPath>(?<channelLogin>\w+)_(?<videoId>\d+)_(?<startTimestamp>\d+))$/;

const TWITCHTRACKER_REGEX =
  /^(?:https:\/\/)?(?<service>twitchtracker)\.com\/(?<channelName>[^/]+)\/streams\/(?<streamId>\d+)$/;
const STREAMSCHARTS_REGEX =
  /^(?:https:\/\/)?(?<service>streamscharts)\.com\/channels\/(?<channelName>[^/]+)\/streams\/(?<streamId>\d+)$/;
const SULLYGNOME_REGEX =
  /^(?:https:\/\/)?(?<service>sullygnome)\.com\/channel\/(?<channelName>[^/]+)\/(?:[^/]+\/)?stream\/(?<streamId>\d+)$/;

type StatsService = 'twitchtracker' | 'streamscharts' | 'sullygnome';
type StatsServiceMatchGroups = {
  service: StatsService;
  channelName: string;
  streamId: string;
};

export type ParsedLinkVodPath = {
  type: 'vodPath';
  vodPath: string;
  channelLogin: string;
  videoId: string;
  startTimestamp: number;
};
export type ParsedLinkVideo = {
  type: 'video';
  videoId: string;
};
export type ParsedLinkClip = {
  type: 'clip';
  slug: string;
};
export type ParsedLinkChannel = {
  type: 'channel';
  channelLogin: string;
};
export type ParsedLinkStatsService = {
  type: 'statsService';
  service: StatsService;
  channelLogin: string;
  streamId: number;
};

export type ParsedLink =
  | ParsedLinkVodPath
  | ParsedLinkVideo
  | ParsedLinkClip
  | ParsedLinkChannel
  | ParsedLinkStatsService;

export const parseLink = (link: string): ParsedLink => {
  let m = link.match(VOD_PATH_REGEX);
  if (m) return { type: 'vodPath', ...m.groups } as ParsedLinkVodPath;
  m = link.match(VIDEO_REGEX_EXACT);
  if (m) {
    const { id } = m.groups as VideoMatchGroups;
    return { type: 'video', videoId: id } satisfies ParsedLinkVideo;
  }
  m = link.match(CLIP_REGEX_EXACT);
  if (m) {
    const { slug } = m.groups as ClipMatchGroups;
    return { type: 'clip', slug } satisfies ParsedLinkClip;
  }
  m = link.match(CHANNEL_REGEX_EXACT);
  if (m) {
    const { channel } = m.groups as ChannelMatchGroups;
    return {
      type: 'channel',
      channelLogin: channel.toLowerCase(),
    } satisfies ParsedLinkChannel;
  }
  m =
    link.match(TWITCHTRACKER_REGEX) ||
    link.match(STREAMSCHARTS_REGEX) ||
    link.match(SULLYGNOME_REGEX);
  if (m) {
    const { service, channelName, streamId } =
      m.groups as StatsServiceMatchGroups;
    return {
      type: 'statsService',
      service,
      channelLogin: channelName,
      streamId: Number.parseInt(streamId),
    } satisfies ParsedLinkStatsService;
  }
  throw new Error('Wrong link');
};
