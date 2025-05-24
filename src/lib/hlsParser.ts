type Rendition = {
  type: 'VIDEO';
  groupId: string;
  name: string;
  isDefault: boolean;
  autoselect: boolean;
};
type Variant = {
  uri: string;
  bandwidth: number;
  codecs: string;
  resolution?: { width: number; height: number };
  frameRate?: number;
  video: Rendition[];
};
export type MasterPlaylist = {
  type: 'playlist';
  isMasterPlaylist: true;
  variants: Variant[];
};

type Segment = {
  type: 'segment';
  uri: string;
  duration: number;
};
export type MediaPlaylist = {
  type: 'playlist';
  isMasterPlaylist: false;
  endlist: boolean;
  segments: Segment[];
};

// https://regex101.com/r/wXjDxJ/1
const PLAYLIST_LINE_KV_REGEX =
  /(?<key>[A-Z-]+)=(?:"(?<stringValue>[^"]+)"|(?<value>[^,]+))/g;

type PlaylistLineKv = {
  key: string;
  stringValue?: string;
  value?: string;
};

const SKIP_TAGS = ['EXTM3U', 'EXT-X-TWITCH-INFO'];
const MASTER_PLAYLIST_TAGS = ['EXT-X-STREAM-INF', 'EXT-X-MEDIA'];

const parseAttrs = (line: string) => {
  const attrs: Record<string, string> = {};
  for (const kv of line.matchAll(PLAYLIST_LINE_KV_REGEX)) {
    const { key, stringValue, value } = kv.groups as PlaylistLineKv;
    attrs[key] = value || stringValue || '';
  }
  return attrs;
};

const parseMasterPlaylist = (lines: string[]): MasterPlaylist => {
  const variants: Variant[] = [];
  for (let i = 0; i < lines.length; i += 3) {
    const media = parseAttrs(lines[i]);
    const streamInf = parseAttrs(lines[i + 1]);
    let resolution = undefined;
    if (streamInf.RESOLUTION) {
      const [width, height] = streamInf.RESOLUTION.split('x').map((n) =>
        Number.parseInt(n),
      );
      resolution = { width, height };
    }
    variants.push({
      uri: lines[i + 2],
      bandwidth: Number.parseInt(streamInf.BANDWIDTH),
      codecs: streamInf.CODECS,
      resolution,
      frameRate: streamInf['FRAME-RATE']
        ? Number.parseFloat(streamInf['FRAME-RATE'])
        : undefined,
      video: [
        {
          type: 'VIDEO',
          groupId: media['GROUP-ID'],
          name: media.NAME,
          isDefault: media.DEFAULT === 'YES',
          autoselect: media.AUTOSELECT === 'YES',
        },
      ],
    });
  }
  return {
    type: 'playlist',
    isMasterPlaylist: true,
    variants,
  };
};

const parseMediaPlaylist = (lines: string[]): MediaPlaylist => {
  const EXTINF = '#EXTINF:';
  const segLines = lines.filter(
    (line) => line.startsWith(EXTINF) || !line.startsWith('#'),
  );
  const segments: Segment[] = [];
  for (let i = 0; i < segLines.length; i += 2) {
    segments.push({
      type: 'segment',
      uri: segLines[i + 1],
      duration: Number.parseFloat(
        segLines[i].replace(EXTINF, '').replace(',', ''),
      ),
    });
  }
  const endlist = lines.includes('#EXT-X-ENDLIST');
  return {
    type: 'playlist',
    isMasterPlaylist: false,
    endlist,
    segments,
  };
};

export const parse = (playlist: string) => {
  const lines = playlist
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !SKIP_TAGS.some((s) => line.startsWith(`#${s}`)));
  const isMasterPlaylist = MASTER_PLAYLIST_TAGS.some((s) =>
    lines.some((line) => line.startsWith(`#${s}:`)),
  );
  return isMasterPlaylist
    ? parseMasterPlaylist(lines)
    : parseMediaPlaylist(lines);
};
