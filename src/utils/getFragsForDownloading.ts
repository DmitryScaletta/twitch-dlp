import * as hlsParser from '../lib/hlsParser.ts';
import type { AppArgs, Frag, Frags } from '../types.ts';

export const getFragsForDownloading = (
  playlistUrl: string,
  playlist: hlsParser.MediaPlaylist,
  args: AppArgs,
) => {
  const baseUrl = playlistUrl.split('/').slice(0, -1).join('/');
  let frags: Frag[] = [];
  let offset = 0;
  let idx = 0;

  const mapFragUri = playlist.segments[0]?.map?.uri;
  let mapFrag: null | Frag = null;
  if (mapFragUri) {
    const url = `${baseUrl}/${mapFragUri}`;
    mapFrag = { idx, offset, duration: 0, isMap: true, url };
    idx += 1;
  }

  for (const { duration, uri } of playlist.segments) {
    const url = `${baseUrl}/${uri}`;
    frags.push({ idx, offset, duration, url });
    offset += duration;
    idx += 1;
  }

  if (args['download-sections']) {
    const [startTime, endTime] = args['download-sections'];
    const firstFragIdx = frags.findLastIndex(
      (frag) => frag.offset <= startTime,
    );
    const lastFragIdx =
      endTime === Infinity
        ? frags.length - 1
        : frags.findIndex((frag) => frag.offset >= endTime);
    frags = frags.slice(firstFragIdx, lastFragIdx + 1);
  }

  if (mapFrag) frags = [mapFrag, ...frags];

  const dlFrags = frags as Frags;
  dlFrags.isFMp4 = !!mapFrag;
  return dlFrags;
};
