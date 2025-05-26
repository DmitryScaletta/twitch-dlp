import * as hlsParser from '../lib/hlsParser.ts';
import type { DownloadFormat } from '../types.ts';

export const parseDownloadFormats = (playlistContent: string) => {
  let formats: DownloadFormat[] = [];
  const playlist = hlsParser.parse(playlistContent) as hlsParser.MasterPlaylist;
  for (let i = 0; i < playlist.variants.length; i += 1) {
    const { uri, resolution, video, frameRate, bandwidth } =
      playlist.variants[i];
    const { name } = video[0];
    formats.push({
      format_id: name.replaceAll(' ', '_'),
      width: resolution?.width || null,
      height: resolution?.height || null,
      frameRate: frameRate ? Math.round(frameRate) : null,
      totalBitrate: bandwidth ? `${(bandwidth / 1024).toFixed()}k` : null,
      source: i === 0 ? true : null,
      url: uri,
    });
  }

  formats.sort((a, b) => (b.height || 0) - (a.height || 0));

  // rename duplicate formats
  const counts: Record<string, number> = {};
  for (const { format_id } of formats) {
    counts[format_id] = (counts[format_id] || 0) + 1;
  }
  const remaining = { ...counts };
  formats = formats.map((format) => {
    const { format_id } = format;
    if (counts[format_id] > 1) {
      const suffix = remaining[format_id] - 1;
      remaining[format_id] -= 1;
      format.format_id = `${format_id}-${suffix}`;
    }
    return format;
  });

  return formats;
};
