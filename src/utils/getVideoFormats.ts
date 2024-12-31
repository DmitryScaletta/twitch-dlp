import crypto from 'node:crypto';
import * as api from '../api/twitch.ts';
import type { BroadcastType, DownloadFormat } from '../types.ts';
import { parseDownloadFormats } from './parseDownloadFormats.ts';
import { VOD_DOMAINS } from '../constants.ts';

export const getVideoFormats = async (videoId: string) => {
  const accessToken = await api.getAccessToken('video', videoId);
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
  resolution = 'chunked',
) => {
  const playlistName =
    broadcastType === 'HIGHLIGHT' ? `highlight-${videoId}` : 'index-dvr';
  return `${vodDomain}/${fullVodPath}/${resolution}/${playlistName}.m3u8`;
};

const getAvailableFormats = async (
  vodDomain: string,
  fullVodPath: string,
  broadcastType?: BroadcastType,
  videoId?: string,
) => {
  const FORMATS_MAP = {
    chunked: 'Source',
    audio_only: 'Audio_Only',
  } as const;
  const RESOLUTIONS = [
    'chunked',
    '720p60',
    '720p30',
    '480p30',
    '360p30',
    '160p30',
    'audio_only',
  ] as const;
  const formats: DownloadFormat[] = [];
  const resolutionUrls = RESOLUTIONS.map((resolution) =>
    getVodUrl(vodDomain, fullVodPath, broadcastType, videoId, resolution),
  );
  const responses = await Promise.all(
    resolutionUrls.map((url) => fetch(url, { method: 'HEAD' })),
  );
  for (const [i, res] of responses.entries()) {
    if (!res.ok) continue;
    const resolution = RESOLUTIONS[i];
    formats.push({
      // @ts-expect-error
      format_id: FORMATS_MAP[resolution] || resolution,
      url: resolutionUrls[i],
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
