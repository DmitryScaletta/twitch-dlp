import { chalk } from '../lib/chalk.ts';
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
  for (let i = 0; i < playlist.variants.length; i += 1) {
    const { uri, resolution, video, frameRate, bandwidth } =
      playlist.variants[i];
    const { name } = video[0];
    formats.push({
      format_id: name.replaceAll(' ', '_'),
      width: resolution?.width || null,
      height: resolution?.height || null,
      frameRate: frameRate ? Math.round(frameRate) : null,
      totalBitrate: bandwidth || null,
      source: i === 0 ? true : null,
      url: uri,
    });
  }

  // formats 1080p+ doesn't exist in a main playlist:
  // - for not logged in users
  // - in some countries
  for (const sessionData of playlist.sessionDataList) {
    if (sessionData.id !== 'com.amazon.ivs.unavailable-media') continue;
    if (!sessionData.value) continue;

    let unavailableMedia: UnavailableMedia[] = [];
    try {
      unavailableMedia = JSON.parse(atob(sessionData.value));
    } catch (e: any) {
      console.warn(
        `${chalk.yellow('WARN:')} Failed to parse unavailable media: ${e.message}`,
      );
    }

    if (unavailableMedia.length > 0) formats.forEach((f) => (f.source = null));

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

    if (formats.every((f) => !f.source)) {
      const last = formats.findLast((f) => f.format_id !== 'Audio_Only');
      if (last) last.source = true;
    }
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
