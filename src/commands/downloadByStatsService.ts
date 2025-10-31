import { getChannelStreams, getStandardSearch } from '../api/sullygnome.ts';
import type { AppArgs } from '../types.ts';
import type {
  ParsedLinkStatsService,
  ParsedLinkVodPath,
} from '../utils/args/parseLink.ts';
import { getWhyCannotDownload } from '../utils/getWhyCannotDownload.ts';
import { downloadByVodPath } from './downloadByVodPath.ts';

const getChannelStream = async (channelLogin: string, streamId: number) => {
  const search = await getStandardSearch(channelLogin);
  const channel = search.find(
    (item) => item.itemtype === 1 && item.siteurl === channelLogin,
  );
  if (!channel) throw new Error(`Channel "${channelLogin}" not found`);

  const channelId = channel.value;
  let page = 0;
  while (true) {
    const channelStreams = await getChannelStreams(channelId, page);
    page += 1;
    const stream = channelStreams.data.find((s) => s.streamId === streamId);
    if (stream) return stream;
    if (page * 100 >= channelStreams.recordsFiltered) {
      const reasons = await getWhyCannotDownload();
      throw new Error(`Stream "${streamId}" not found\n\n${reasons}`);
    }
  }
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
