import { parsePlaylist } from '../lib/m3u8.ts';
import type { DownloadFormat } from '../types.ts';

export const parseDownloadFormats = (playlistContent: string) => {
  const formats: DownloadFormat[] = [];
  for (const { name, width, height, url } of parsePlaylist(playlistContent)) {
    formats.push({
      format_id: name.replaceAll(' ', '_'),
      width,
      height,
      // workaround for some old muted highlights
      // https://regex101.com/r/HdZKlP/1
      url: url.replace(/-muted-\w+(?=\.m3u8$)/, ''),
    });
  }
  return formats;
};
