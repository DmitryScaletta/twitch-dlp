import * as streamcharts from '../api/streamcharts.ts';
import * as sullygnome from '../api/sullygnome.ts';
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
  const search = await sullygnome.getStandardSearch(channelLogin);
  const channel = search.find(
    (item) =>
      item.itemtype === sullygnome.STANDARD_SEARCH_ITEM_TYPE.CHANNEL &&
      item.siteurl === channelLogin,
  );
  if (!channel) {
    throw new StreamNotFoundError(`Channel "${channelLogin}" not found`);
  }

  const channelId = channel.value;
  let page = 0;
  let channelStreams: Awaited<ReturnType<typeof sullygnome.getChannelStreams>>;

  do {
    channelStreams = await sullygnome.getChannelStreams(channelId, page);
    const stream = channelStreams.data.find((s) => s.streamId === streamId);
    if (stream) return stream;
    page += 1;
  } while (
    page * sullygnome.CHANNEL_STREAMS_PAGE_SIZE <
    channelStreams.recordsFiltered
  );

  const reasons = await getWhyCannotDownload();
  throw new StreamNotFoundError(`Stream "${streamId}" not found\n\n${reasons}`);
};

export const downloadByStatsService = async (
  { channelLogin, streamId, service, url }: ParsedLinkStatsService,
  args: AppArgs,
) => {
  let startDate: string | null = null;

  try {
    const stream = await getChannelStream(channelLogin, streamId);
    startDate = stream.startDateTime;
  } catch (e) {
    if (e instanceof StreamNotFoundError) throw e;
  }

  if (startDate === null) {
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
      startDate = streamInfo.created_at;
    } else if (service === 'streamscharts') {
      const html = await fetchHtmlWithBrowser(url, args);
      const comps = streamcharts.parseLivewireComponents(html);
      const comp = comps.find((c: any) => c.serverMemo.data.stream) as
        | Record<string, any>
        | undefined;
      if (!comp) throw new Error('Cannot get a stream info');
      startDate =
        (comp.serverMemo.data.stream.stream_created_at as string) + '+00:00';
    } else if (service === 'sullygnome') {
      throw new Error(`Not implemented for ${service}`);
    } else {
      startDate = null as never;
    }
  }

  const startTimestamp = new Date(startDate).getTime() / 1000;

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
