import crypto from 'node:crypto';
import * as api from '../api/twitch.ts';
import { VOD_DOMAINS } from '../constants.ts';
import type { BroadcastType, DownloadFormat } from '../types.ts';
import { parseDownloadFormats } from './parseDownloadFormats.ts';

const FORMATS = [
  'chunked',
  '720p60',
  '720p30',
  '480p30',
  '360p30',
  '160p30',
  'audio_only',
] as const;
const FORMATS_MAP: Record<string, string> = {
  chunked: 'Source',
  audio_only: 'Audio_Only',
};

export const getVideoFormats = async (videoId: string) => {
  const accessToken = await api.getVideoAccessToken(videoId);
  if (!accessToken) return [];
  const manifest = await api.getManifest(videoId, accessToken);
  if (!manifest) return [];
  const formats = parseDownloadFormats(manifest);
  formats.sort((a, b) => (b.width || 0) - (a.width || 0));
  return formats;
};

export const getFullVodPath = (vodPath: string) => {
  const hashedVodPath = crypto
    .createHash('sha1')
    .update(vodPath)
    .digest('hex')
    .slice(0, 20);
  return `${hashedVodPath}_${vodPath}`;
};

const getVodUrl = (
  vodDomain: string,
  fullVodPath: string,
  broadcastType: BroadcastType = 'ARCHIVE',
  videoId = '',
  format = 'chunked',
) => {
  const playlistName =
    broadcastType === 'HIGHLIGHT' ? `highlight-${videoId}` : 'index-dvr';
  return `${vodDomain}/${fullVodPath}/${format}/${playlistName}.m3u8`;
};

const getAvailableFormats = async (
  vodDomain: string,
  fullVodPath: string,
  broadcastType?: BroadcastType,
  videoId?: string,
) => {
  const formats: DownloadFormat[] = [];
  const formatUrls = FORMATS.map((format) =>
    getVodUrl(vodDomain, fullVodPath, broadcastType, videoId, format),
  );
  const responses = await Promise.all(
    formatUrls.map((url) => fetch(url, { method: 'HEAD' })),
  );
  for (const [i, res] of responses.entries()) {
    if (!res.ok) continue;
    const format = FORMATS[i];
    const [widthStr, frameRateStr] = format.split('p');
    formats.push({
      format_id: FORMATS_MAP[format] || format,
      width: widthStr ? Number.parseInt(widthStr) : null,
      frameRate: frameRateStr ? Number.parseInt(frameRateStr) : null,
      url: formatUrls[i],
    });
  }
  return formats;
};

export const getVideoFormatsByFullVodPath = async (
  fullVodPath: string,
  broadcastType?: BroadcastType,
  videoId?: string,
) => {
  const responses = await Promise.all(
    VOD_DOMAINS.map((domain) => {
      const url = getVodUrl(domain, fullVodPath, broadcastType, videoId);
      return fetch(url, { method: 'HEAD' });
    }),
  );
  const vodDomainIdx = responses.findIndex((res) => res.ok);
  if (vodDomainIdx === -1) return [];
  return getAvailableFormats(
    VOD_DOMAINS[vodDomainIdx],
    fullVodPath,
    broadcastType,
    videoId,
  );
};

// thumb subdomain is not always the same as playlist subdomain
// https://regex101.com/r/t8lsxY/1
const THUMB_REGEX =
  /cf_vods\/(?<subdomain>[^\/]+)\/(?<fullVodPath>(?:[^\/]+|[^\/]+\/[^\/]+\/[^\/]+))\/?\/thumb\//;

type ThumbGroups = {
  subdomain: string;
  fullVodPath: string;
};

export const getVideoFormatsByThumbUrl = (
  broadcastType: BroadcastType,
  videoId: string,
  thumbUrl: string,
) => {
  const m = thumbUrl.match(THUMB_REGEX);
  if (!m) return [];
  const { fullVodPath } = m.groups as ThumbGroups;
  return getVideoFormatsByFullVodPath(fullVodPath, broadcastType, videoId);
};
