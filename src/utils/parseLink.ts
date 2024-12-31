const VOD_REGEX = /^https:\/\/(?:www\.)?twitch\.tv\/videos\/(?<videoId>\d+)/;
const CHANNEL_REGEX =
  /^https:\/\/(?:www\.)?twitch\.tv\/(?<channelLogin>[^/#?]+)/;

type ParsedLink =
  | { type: 'vodPath'; vodPath: string }
  | { type: 'video'; videoId: string }
  | { type: 'channel'; channelLogin: string };

export const parseLink = (link: string): ParsedLink => {
  if (link.startsWith('video:')) {
    return { type: 'vodPath', vodPath: link.replace('video:', '') };
  }
  let m = link.match(VOD_REGEX);
  if (m) return { type: 'video', videoId: m.groups!.videoId };
  m = link.match(CHANNEL_REGEX);
  if (m) return { type: 'channel', channelLogin: m.groups!.channelLogin };
  throw new Error('Wrong link');
};
