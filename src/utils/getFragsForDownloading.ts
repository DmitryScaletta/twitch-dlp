import * as hlsParser from '../lib/hlsParser.ts';
import type { AppArgs, Frag } from '../types.ts';

export const getFragsForDownloading = (
  playlistUrl: string,
  playlist: hlsParser.MediaPlaylist,
  args: AppArgs,
) => {
  const baseUrl = playlistUrl.split('/').slice(0, -1).join('/');
  const frags: Frag[] = [];
  let offset = 0;
  let idx = 0;
  for (const { duration, uri } of playlist.segments) {
    frags.push({ idx, offset, duration, url: `${baseUrl}/${uri}` });
    offset += duration;
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
