// https://regex101.com/r/wXjDxJ/1
const PLAYLIST_LINE_KV_REGEX =
  /(?<key>[A-Z-]+)=(?:"(?<stringValue>[^"]+)"|(?<value>[^,]+))/g;

type PlaylistLineKv = {
  key: string;
  stringValue?: string;
  value?: string;
};

type PlaylistSegment = {
  groupId: string;
  name: string;
  width: number | null;
  height: number | null;
  bandwidth: number;
  codecs: string;
  frameRate: number | null;
  url: string;
};

type VodSegment = {
  duration: string;
  url: string;
};

const parseAttrs = (line: string) => {
  const attrs: Record<string, string> = {};
  for (const kv of line.matchAll(PLAYLIST_LINE_KV_REGEX)) {
    const { key, stringValue, value } = kv.groups as PlaylistLineKv;
    attrs[key] = value || stringValue || '';
  }
  return attrs;
};

export const parsePlaylist = (playlist: string) => {
  const segments: PlaylistSegment[] = [];
  const HEADER_TAGS = ['#EXTM3U', '#EXT-X-TWITCH-INFO'];
  const lines = playlist
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !HEADER_TAGS.some((s) => line.startsWith(s)));
  for (let i = 0; i < lines.length; i += 3) {
    const media = parseAttrs(lines[i]);
    const streamInf = parseAttrs(lines[i + 1]);
    const [width, height] = streamInf.RESOLUTION
      ? streamInf.RESOLUTION.split('x').map((n) => Number.parseInt(n))
      : [null, null];
    segments.push({
      groupId: media['GROUP-ID'],
      name: media.NAME,
      width,
      height,
      bandwidth: Number.parseInt(streamInf.BANDWIDTH),
      codecs: streamInf.CODECS,
      frameRate: streamInf['FRAME-RATE']
        ? Number.parseFloat(streamInf['FRAME-RATE'])
        : null,
      url: lines[i + 2],
    });
  }
  return segments;
};

export const parseVod = (playlist: string) => {
  const EXTINF = '#EXTINF:';
  const lines = playlist
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith(EXTINF) || !line.startsWith('#'));
  const segments: VodSegment[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    segments.push({
      duration: lines[i].replace(EXTINF, '').replace(',', ''),
      url: lines[i + 1],
    });
  }
  return segments;
};
