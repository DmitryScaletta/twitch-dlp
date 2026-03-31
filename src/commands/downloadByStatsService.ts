import * as api from '../api/sullygnome.ts';
import * as twitchtracker from '../api/twitchtracker.ts';
import type { AppArgs } from '../types.ts';
import type {
  ParsedLinkStatsService,
  ParsedLinkVodPath,
} from '../utils/args/parseLink.ts';
import { fetchHtmlWithBrowser } from '../utils/fetchHtmlWithBrowser.ts';
import { getWhyCannotDownload } from '../utils/getWhyCannotDownload.ts';
import { downloadByVodPath } from './downloadByVodPath.ts';

class StreamNotFoundError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const getChannelStream = async (channelLogin: string, streamId: number) => {
  const search = await api.getStandardSearch(channelLogin);
  const channel = search.find(
    (item) =>
      item.itemtype === api.STANDARD_SEARCH_ITEM_TYPE.CHANNEL &&
      item.siteurl === channelLogin,
  );
  if (!channel) {
    throw new StreamNotFoundError(`Channel "${channelLogin}" not found`);
  }

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
  throw new StreamNotFoundError(`Stream "${streamId}" not found\n\n${reasons}`);
};

export const downloadByStatsService = async (
  { channelLogin, streamId, service, url }: ParsedLinkStatsService,
  args: AppArgs,
) => {
  let startTimestamp: number | null = null;

  try {
    const stream = await getChannelStream(channelLogin, streamId);
    startTimestamp = new Date(stream.startDateTime).getTime() / 1000;
  } catch (e) {
    if (e instanceof StreamNotFoundError) throw e;
  }

  if (startTimestamp === null) {
    console.warn('[download] Cannot get a stream info');
    if (!args.webbrowser) {
      console.warn('[download] You can enable --webbrowser and try again');
      process.exit(1);
    }
    console.warn(
      '[download] Using webbrowser. This feature is experimental and may not work',
    );
    if (service === 'twitchtracker') {
      const html = await fetchHtmlWithBrowser(url, args);
      const streamInfo = twitchtracker.getStreamInfo(html);
      startTimestamp = new Date(streamInfo.created_at).getTime() / 1000;
    } else {
      throw new Error(
        `[download] Web browser is not implemented for ${service}`,
      );
    }
  }

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
