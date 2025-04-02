export const PRIVATE_VIDEO_INSTRUCTIONS =
  'This video might be private. Follow this article to download it: https://github.com/DmitryScaletta/twitch-dlp/blob/master/DOWNLOAD_PRIVATE_VIDEOS.md';
export const VOD_DOMAINS = [
  'https://d2e2de1etea730.cloudfront.net',
  'https://dqrpb9wgowsf5.cloudfront.net',
  'https://ds0h3roq6wcgc.cloudfront.net',
  'https://d2nvs31859zcd8.cloudfront.net',
  'https://d2aba1wr3818hz.cloudfront.net',
  'https://d3c27h4odz752x.cloudfront.net',
  'https://dgeft87wbj63p.cloudfront.net',
  'https://d1m7jfoe9zdc1j.cloudfront.net',
  'https://d3vd9lfkzbru3h.cloudfront.net',
  'https://d2vjef5jvl6bfs.cloudfront.net',
  'https://d1ymi26ma8va5x.cloudfront.net',
  'https://d1mhjrowxxagfy.cloudfront.net',
  'https://ddacn6pr5v0tl.cloudfront.net',
  'https://d3aqoihi2n8ty8.cloudfront.net',
];

export const DOWNLOADERS = ['aria2c', 'curl', 'fetch'] as const;
export const MERGE_METHODS = ['ffconcat', 'append'] as const;
export const UNMUTE_POLICIES = [
  'quality',
  'any',
  'same_format',
  'none',
] as const;

export const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

export const RET_CODE = {
  OK: 0,
  UNKNOWN_ERROR: 1,
  HTTP_RETURNED_ERROR: 22,
};
