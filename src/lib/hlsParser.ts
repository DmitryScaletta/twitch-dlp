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
type SessionData = {
  id: string;
  value: string;
};
export type MasterPlaylist = {
  type: 'playlist';
  isMasterPlaylist: true;
  variants: Variant[];
  sessionDataList: SessionData[];
};

type Segment = {
  type: 'segment';
  uri: string;
  duration: number;
  map: null | { uri: string };
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
  const mediaLines = lines.filter(
    (line) =>
      MASTER_PLAYLIST_TAGS.some((s) => line.startsWith(`#${s}:`)) ||
      !line.startsWith('#'),
  );
  for (let i = 0; i < mediaLines.length; i += 3) {
    const media = parseAttrs(mediaLines[i]);
    const streamInf = parseAttrs(mediaLines[i + 1]);
    let resolution = undefined;
    if (streamInf.RESOLUTION) {
      const [width, height] = streamInf.RESOLUTION.split('x').map((n) =>
        Number.parseInt(n),
      );
      resolution = { width, height };
    }
    variants.push({
      uri: mediaLines[i + 2],
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

  const sessionDataList: SessionData[] = [];
  for (const line of lines) {
    if (line.startsWith('#EXT-X-SESSION-DATA:')) {
      const sessionData = parseAttrs(line);
      sessionDataList.push({
        id: sessionData['DATA-ID'],
        value: sessionData.VALUE,
      });
    }
  }

  return {
    type: 'playlist',
    isMasterPlaylist: true,
    variants,
    sessionDataList,
  };
};

const parseMediaPlaylist = (lines: string[]): MediaPlaylist => {
  const EXTINF = '#EXTINF:';
  const EXT_X_MAP = '#EXT-X-MAP:';

  let map = null;
  let mapLine = lines.find((line) => line.startsWith(EXT_X_MAP));
  if (mapLine) {
    const mapData = parseAttrs(mapLine);
    if (mapData?.URI) map = { uri: mapData.URI };
  }

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
      map,
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
    .filter(Boolean);
  const isMasterPlaylist = MASTER_PLAYLIST_TAGS.some((s) =>
    lines.some((line) => line.startsWith(`#${s}:`)),
  );
  return isMasterPlaylist
    ? parseMasterPlaylist(lines)
    : parseMediaPlaylist(lines);
};
