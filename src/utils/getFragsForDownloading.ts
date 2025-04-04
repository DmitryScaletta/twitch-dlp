import { parseVod } from '../lib/m3u8.ts';
import type { AppArgs } from '../main.ts';
import type { Frag } from '../types.ts';

export const getFragsForDownloading = (
  playlistUrl: string,
  playlistContent: string,
  args: AppArgs,
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
  if (!args['download-sections']) return frags;
  const [startTime, endTime] = args['download-sections'];
  const firstFragIdx = frags.findLastIndex((frag) => frag.offset <= startTime);
  const lastFragIdx =
    endTime === Infinity
      ? frags.length - 1
      : frags.findIndex((frag) => frag.offset >= endTime);
  return frags.slice(firstFragIdx, lastFragIdx + 1);
};
