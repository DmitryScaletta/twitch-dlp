type StandardSearchItem = {
  /** Example: Summit1g */
  displaytext: string;
  value: number;
  /** Example: 6,338,452 */
  description: string;
  itemtype: (typeof STANDARD_SEARCH_ITEM_TYPE)[keyof typeof STANDARD_SEARCH_ITEM_TYPE];
  /** Example: summit1g */
  siteurl: string;
  boxart: string;
};
type StandardSearchResponse = StandardSearchItem[];

type ChannelStream = {
  rownum: number;
  /** Example: Thursday 30th October 2025 18:29 */
  starttime: string;
  /** Example: Thursday 30th October 2025 21:00 */
  endtime: string;
  /** In minutes */
  length: number;
  viewgain: number;
  followergain: number;
  avgviewers: number;
  maxviewers: number;
  followersperhour: number;
  /** Example: Just Chatting|Just_Chatting|https://static-cdn.jtvnw.net/ttv-boxart/509658-136x190.jpg?imenable=1&impolicy=user-profile-picture&imwidth=100 */
  gamesplayed: string;
  viewsperhour: number;
  channeldisplayname: string;
  channellogo: string;
  /** Example: summit1g */
  channelurl: string;
  /** Example: 2025-10-30T18:29:17Z */
  startDateTime: string;
  streamId: number;
  /** Example: https://sullygnome.com/channel/summit1g/stream/315782796250 */
  streamUrl: string;
  viewminutes: number;
};
type ChannelStreamsResponse = {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: ChannelStream[];
  progressProps: {
    key:
      | 'viewgain'
      | 'followergain'
      | 'maxviewers'
      | 'avgviewers'
      | 'followersperhour'
      | 'viewsperhour'
      | 'length'
      | 'viewminutes';
    value: number;
  }[];
};

const BASE_URL = 'https://sullygnome.com/api';

export const STANDARD_SEARCH_ITEM_TYPE = {
  CHANNEL: 1,
  GAME: 2,
  TEAM: 4,
} as const;

export const getStandardSearch = async (query: string) => {
  const url = `${BASE_URL}/standardsearch/${query}`;
  const res = await fetch(url);
  return res.json() as Promise<StandardSearchResponse>;
};

export const CHANNEL_STREAMS_PAGE_SIZE = 100;

export const getChannelStreams = async (
  channelId: number,
  page = 0,
  pageSize = CHANNEL_STREAMS_PAGE_SIZE,
) => {
  const pageN = page + 1;
  const start = page * pageSize;
  const url = `${BASE_URL}/tables/channeltables/streams/365/${channelId}/%20/${pageN}/1/desc/${start}/${pageSize}`;
  const res = await fetch(url);
  return res.json() as Promise<ChannelStreamsResponse>;
};
