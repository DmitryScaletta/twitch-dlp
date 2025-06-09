import * as hlsParser from '../lib/hlsParser.ts';
import type { DownloadFormat } from '../types.ts';

type UnavailableMedia = {
  NAME: string;
  BANDWIDTH: number;
  CODECS: string;
  RESOLUTION: string;
  FILTER_REASONS: string[];
  AUTHORIZATION_REASONS: string[];
  'GROUP-ID': string;
  'FRAME-RATE': number;
};

export const parseDownloadFormats = (playlistContent: string) => {
  let formats: DownloadFormat[] = [];
  const playlist = hlsParser.parse(playlistContent) as hlsParser.MasterPlaylist;
  for (const {
    uri,
    resolution,
    video,
    frameRate,
    bandwidth,
  } of playlist.variants) {
    const { name } = video[0];
    formats.push({
      format_id: name.replaceAll(' ', '_'),
      width: resolution?.width || null,
      height: resolution?.height || null,
      frameRate: frameRate ? Math.round(frameRate) : null,
      totalBitrate: bandwidth || null,
      source: uri.includes('/chunked/') || null,
      url: uri,
    });
  }

  // formats 1080p+ doesn't exist in a main playlist:
  // - for not logged in users
  // - in some countries
  const unavailableMediaRaw = playlist.sessionDataList?.[0]?.value;
  if (unavailableMediaRaw) {
    const unavailableMedia = JSON.parse(
      Buffer.from(unavailableMediaRaw, 'base64').toString('utf8'),
    ) as UnavailableMedia[];
    for (const media of unavailableMedia) {
      const [width, height] = media.RESOLUTION
        ? media.RESOLUTION.split('x').map((v) => Number.parseInt(v))
        : [null, null];

      let urlArr = formats[0].url.split('/');
      urlArr = urlArr.with(-2, media['GROUP-ID']);
      const url = urlArr.join('/');

      formats.push({
        format_id: media.NAME.replaceAll(' ', '_'),
        width,
        height,
        frameRate: media['FRAME-RATE'] ? Math.round(media['FRAME-RATE']) : null,
        totalBitrate: media.BANDWIDTH || null,
        source: media['GROUP-ID'] === 'chunked' || null,
        url,
      });
    }
  }

  formats.sort((a, b) => (b.height || 0) - (a.height || 0));

  if (!formats.some((f) => f.source)) {
    let max = -Infinity;
    let maxI = -1;
    for (let i = 0; i < formats.length; i += 1) {
      if (formats[i].totalBitrate || 0 > max) {
        max = formats[i].totalBitrate || 0;
        maxI = i;
      }
    }
    formats[maxI].source = true;
  }

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
