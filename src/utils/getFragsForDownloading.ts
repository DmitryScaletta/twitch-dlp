import { parseVod } from '../lib/m3u8.ts';
import type { Frag } from '../types.ts';
import { parseDownloadSectionsArg } from './parseDownloadSectionsArg.ts';

export const getFragsForDownloading = (
  playlistUrl: string,
  playlistContent: string,
  downloadSectionsArg?: string,
) => {
  const baseUrl = playlistUrl.split('/').slice(0, -1).join('/');
  const frags: Frag[] = [];
  let offset = 0;
  let idx = 0;
  for (const { duration, url } of parseVod(playlistContent)) {
    frags.push({ idx, offset, duration, url: `${baseUrl}/${url}` });
    offset += Number.parseFloat(duration);
    idx += 1;
  }
  const downloadSections = parseDownloadSectionsArg(downloadSectionsArg);
  if (!downloadSections) return frags;
  const { startTime, endTime } = downloadSections;
  const firstFragIdx = frags.findLastIndex((frag) => frag.offset <= startTime);
  const lastFragIdx =
    endTime === Infinity
      ? frags.length - 1
      : frags.findIndex((frag) => frag.offset >= endTime);
  return frags.slice(firstFragIdx, lastFragIdx + 1);
};
