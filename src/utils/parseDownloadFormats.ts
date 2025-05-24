import * as hlsParser from '../lib/hlsParser.ts';
import type { DownloadFormat } from '../types.ts';

export const parseDownloadFormats = (playlistContent: string) => {
  const formats: DownloadFormat[] = [];
  const playlist = hlsParser.parse(playlistContent) as hlsParser.MasterPlaylist;
  for (const { uri, resolution, video } of playlist.variants) {
    const { name } = video[0];
    formats.push({
      format_id: name.replaceAll(' ', '_'),
      width: resolution?.width || null,
      height: resolution?.height || null,
      url: uri,
    });
  }
  return formats;
};
