// https://regex101.com/r/tvGCMP/2
const VOD_PATH_REGEX =
  /^video:(?<vodPath>(?<channelLogin>\w+)_(?<videoId>\d+)_(?<startTimestamp>\d+))$/;
const VOD_REGEX = /^https:\/\/(?:www\.)?twitch\.tv\/videos\/(?<videoId>\d+)/;
const CHANNEL_REGEX =
  /^https:\/\/(?:www\.)?twitch\.tv\/(?<channelLogin>[^/#?]+)/;

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
export type ParsedLinkChannel = {
  type: 'channel';
  channelLogin: string;
};
export type ParsedLink =
  | ParsedLinkVodPath
  | ParsedLinkVideo
  | ParsedLinkChannel;

export const parseLink = (link: string): ParsedLink => {
  let m = link.match(VOD_PATH_REGEX);
  if (m) return { type: 'vodPath', ...m.groups } as ParsedLinkVodPath;
  m = link.match(VOD_REGEX);
  if (m) return { type: 'video', ...m.groups } as ParsedLinkVideo;
  m = link.match(CHANNEL_REGEX);
  if (m) return { type: 'channel', ...m.groups } as ParsedLinkChannel;
  throw new Error('Wrong link');
};
