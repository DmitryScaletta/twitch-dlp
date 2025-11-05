import * as api from '../api/sullygnome.ts';
import type { AppArgs } from '../types.ts';
import type {
  ParsedLinkStatsService,
  ParsedLinkVodPath,
} from '../utils/args/parseLink.ts';
import { getWhyCannotDownload } from '../utils/getWhyCannotDownload.ts';
import { downloadByVodPath } from './downloadByVodPath.ts';

const getChannelStream = async (channelLogin: string, streamId: number) => {
  const search = await api.getStandardSearch(channelLogin);
  const channel = search.find(
    (item) =>
      item.itemtype === api.STANDARD_SEARCH_ITEM_TYPE.CHANNEL &&
      item.siteurl === channelLogin,
  );
  if (!channel) throw new Error(`Channel "${channelLogin}" not found`);

  const channelId = channel.value;
  let page = 0;
  let channelStreams: Awaited<ReturnType<typeof api.getChannelStreams>>;

  do {
    channelStreams = await api.getChannelStreams(channelId, page);
    const stream = channelStreams.data.find((s) => s.streamId === streamId);
    if (stream) return stream;
    page += 1;
  } while (
    page * api.CHANNEL_STREAMS_PAGE_SIZE <
    channelStreams.recordsFiltered
  );

  const reasons = await getWhyCannotDownload();
  throw new Error(`Stream "${streamId}" not found\n\n${reasons}`);
};

export const downloadByStatsService = async (
  { channelLogin, streamId }: ParsedLinkStatsService,
  args: AppArgs,
) => {
  const stream = await getChannelStream(channelLogin, streamId);
  const startTimestamp = new Date(stream.startDateTime).getTime() / 1000;
  return downloadByVodPath(
    {
      type: 'vodPath',
      vodPath: `${channelLogin}_${streamId}_${startTimestamp}`,
      channelLogin,
      videoId: `${streamId}`,
      startTimestamp,
    } satisfies ParsedLinkVodPath,
    args,
  );
};
