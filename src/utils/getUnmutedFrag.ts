import { UNMUTE_POLICIES } from '../constants.ts';
import type { Downloader, DownloadFormat } from '../types.ts';
import { isUrlsAvailable } from '../downloaders/index.ts';

const [QUALITY, ANY, SAME_FORMAT, NONE] = UNMUTE_POLICIES;

const LOWER_AUDIO_QUALITY = ['160p30', '360p30'];
const SAME_FORMAT_SLUGS = ['audio_only', ...LOWER_AUDIO_QUALITY];

const getFormatSlug = (url: string) => url.split('/').at(-2)!;

export const getUnmutedFrag = async (
  downloader: Downloader,
  unmutePolicy: string | undefined,
  fragUrl: string,
  formats: DownloadFormat[],
) => {
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
    const [available, availableGzip] = await isUrlsAvailable(downloader, [url]);
    if (available) return { sameFormat: true, url: url, gzip: false };
    if (availableGzip) return { sameFormat: true, url: url, gzip: true };
    return null;
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

    let [available, availableGzip] = responses[currentFormatIdx];
    let url = urls[currentFormatIdx];
    if (available) return { sameFormat: true, url, gzip: false };
    if (availableGzip) return { sameFormat: true, url, gzip: true };

    const idx = responses.findLastIndex(([av, avGzip]) => av || avGzip);

    if (idx === -1) return null;
    [available, availableGzip] = responses[idx];
    url = urls[idx];
    if (available) return { sameFormat: false, url, gzip: false };
    if (availableGzip) return { sameFormat: false, url, gzip: true };
    return null;
  }

  throw new Error(
    `Unknown unmute policy: ${unmutePolicy}. Available: ${UNMUTE_POLICIES}`,
  );
};
