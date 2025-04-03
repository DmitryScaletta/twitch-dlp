import { UNMUTE_POLICIES } from '../constants.ts';
import { isUrlsAvailable } from '../downloaders/index.ts';
import type { Downloader, DownloadFormat } from '../types.ts';

const [QUALITY, ANY, SAME_FORMAT, NONE] = UNMUTE_POLICIES;

const LOWER_AUDIO_QUALITY = ['160p30', '360p30'];
const SAME_FORMAT_SLUGS = ['audio_only', ...LOWER_AUDIO_QUALITY];

export type UnmutedFrag = {
  sameFormat: boolean;
  url: string;
  gzip: boolean;
};

const getFormatSlug = (url: string) => url.split('/').at(-2)!;

const getFragResponse = (
  [available, availableGzip]: readonly [boolean, boolean],
  sameFormat: boolean,
  url: string,
) => {
  if (available) return { sameFormat, url, gzip: false };
  if (availableGzip) return { sameFormat, url, gzip: true };
  return null;
};

export const getUnmutedFrag = async (
  downloader: Downloader,
  unmutePolicy: string | undefined,
  fragUrl: string,
  formats: DownloadFormat[],
): Promise<UnmutedFrag | null> => {
  if (unmutePolicy === NONE) return null;

  const currentFormatSlug = getFormatSlug(fragUrl);

  if (unmutePolicy === ANY && currentFormatSlug === 'audio_only') {
    unmutePolicy = SAME_FORMAT;
  }

  if (!unmutePolicy) {
    unmutePolicy = SAME_FORMAT_SLUGS.includes(currentFormatSlug)
      ? SAME_FORMAT
      : QUALITY;
  }

  if (unmutePolicy === SAME_FORMAT) {
    const url = fragUrl.replace('-muted', '');
    const [availability] = await isUrlsAvailable(downloader, [url]);
    return getFragResponse(availability, true, url);
  }

  if (unmutePolicy === ANY || unmutePolicy === QUALITY) {
    const urls: string[] = [];
    let currentFormatIdx = -1;
    for (let i = 0; i < formats.length; i += 1) {
      const formatSlug = getFormatSlug(formats[i].url);
      if (
        unmutePolicy === QUALITY &&
        LOWER_AUDIO_QUALITY.includes(formatSlug)
      ) {
        continue;
      }
      if (formatSlug === currentFormatSlug) currentFormatIdx = i;
      urls.push(
        fragUrl
          .replace('-muted', '')
          .replace(`/${currentFormatSlug}/`, `/${formatSlug}/`),
      );
    }
    const responses = await isUrlsAvailable(downloader, urls);

    const unmutedSameFormat = getFragResponse(
      responses[currentFormatIdx],
      true,
      urls[currentFormatIdx],
    );
    if (unmutedSameFormat) return unmutedSameFormat;

    const idx = responses.findLastIndex(([av, avGzip]) => av || avGzip);
    if (idx === -1) return null;
    return getFragResponse(responses[idx], false, urls[idx]);
  }

  throw new Error(
    `Unknown unmute policy: ${unmutePolicy}. Available: ${UNMUTE_POLICIES}`,
  );
};
