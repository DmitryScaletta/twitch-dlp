export const DEFAULT_OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s';
export const PRIVATE_VIDEO_INSTRUCTIONS =
  'This video might be private. Follow this article to download it: https://github.com/DmitryScaletta/twitch-dlp/blob/master/DOWNLOAD_PRIVATE_VIDEOS.md';
export const NO_TRY_UNMUTE_MESSAGE =
  '[unmute] The video is old, not trying to unmute';
export const VOD_DOMAINS = [
  'https://ds0h3roq6wcgc.cloudfront.net',
  'https://d2nvs31859zcd8.cloudfront.net',
  'https://d2aba1wr3818hz.cloudfront.net',
  'https://d3c27h4odz752x.cloudfront.net',
  'https://dgeft87wbj63p.cloudfront.net',
  'https://d1m7jfoe9zdc1j.cloudfront.net',
  'https://d3vd9lfkzbru3h.cloudfront.net',
  'https://ddacn6pr5v0tl.cloudfront.net',
  'https://d3aqoihi2n8ty8.cloudfront.net',
  'https://d3fi1amfgojobc.cloudfront.net',
  'https://d2vi6trrdongqn.cloudfront.net',
];

export const DOWNLOADERS = ['aria2c', 'curl', 'fetch'] as const;
export const MERGE_METHODS = ['ffconcat', 'append'] as const;
export const UNMUTE = {
  QUALITY: 'quality',
  ANY: 'any',
  SAME_FORMAT: 'same_format',
  OFF: 'off',
} as const;

export const RET_CODE = {
  OK: 0,
  UNKNOWN_ERROR: 1,
  HTTP_RETURNED_ERROR: 22,
} as const;
