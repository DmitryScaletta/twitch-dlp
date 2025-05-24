import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import * as hlsParser from './hlsParser.ts';

describe('hlsParser', async () => {
  const mocks: Record<string, string> = {};

  const mdPath = path.resolve(import.meta.dirname, 'hlsParser.mock.md');
  const md = await fsp.readFile(mdPath, 'utf-8');
  const MOCKS_REGEX = /##\s+(?<name>\w+)[\s\S]*?```ini(?<content>[\s\S]*?)```/g;
  for (const m of md.matchAll(MOCKS_REGEX)) {
    const { name, content } = m.groups as { name: string; content: string };
    mocks[name] = content;
  }

  it('should parse master playlist', () => {
    assert.deepStrictEqual(hlsParser.parse(mocks.masterPlaylist), {
      type: 'playlist',
      isMasterPlaylist: true,
      variants: [
        {
          uri: 'https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/chunked/index-dvr.m3u8',
          bandwidth: 6356993,
          codecs: 'avc1.640032,mp4a.40.2',
          resolution: { width: 2560, height: 1440 },
          frameRate: 30,
          video: [
            {
              type: 'VIDEO',
              groupId: 'chunked',
              name: '1440p',
              isDefault: false,
              autoselect: false,
            },
          ],
        },
        {
          uri: 'https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/720p30/index-dvr.m3u8',
          bandwidth: 2367665,
          codecs: 'avc1.4D001F,mp4a.40.2',
          resolution: { width: 1280, height: 720 },
          frameRate: 30,
          video: [
            {
              type: 'VIDEO',
              groupId: '720p30',
              name: '720p',
              isDefault: true,
              autoselect: true,
            },
          ],
        },
        {
          uri: 'https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/480p30/index-dvr.m3u8',
          bandwidth: 1452306,
          codecs: 'avc1.4D001F,mp4a.40.2',
          resolution: { width: 852, height: 480 },
          frameRate: 30,
          video: [
            {
              type: 'VIDEO',
              groupId: '480p30',
              name: '480p',
              isDefault: true,
              autoselect: true,
            },
          ],
        },
        {
          uri: 'https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/audio_only/index-dvr.m3u8',
          bandwidth: 196037,
          codecs: 'mp4a.40.2',
          resolution: undefined,
          frameRate: undefined,
          video: [
            {
              type: 'VIDEO',
              groupId: 'audio_only',
              name: 'Audio Only',
              isDefault: false,
              autoselect: false,
            },
          ],
        },
        {
          uri: 'https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/360p30/index-dvr.m3u8',
          bandwidth: 736068,
          codecs: 'avc1.4D001E,mp4a.40.2',
          resolution: { width: 640, height: 360 },
          frameRate: 30,
          video: [
            {
              type: 'VIDEO',
              groupId: '360p30',
              name: '360p',
              isDefault: true,
              autoselect: true,
            },
          ],
        },
        {
          uri: 'https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/160p30/index-dvr.m3u8',
          bandwidth: 296388,
          codecs: 'avc1.4D000C,mp4a.40.2',
          resolution: { width: 284, height: 160 },
          frameRate: 30,
          video: [
            {
              type: 'VIDEO',
              groupId: '160p30',
              name: '160p',
              isDefault: true,
              autoselect: true,
            },
          ],
        },
      ],
    });
  });

  it('should parse media playlist', () => {
    assert.deepStrictEqual(hlsParser.parse(mocks.mediaPlaylist), {
      type: 'playlist',
      isMasterPlaylist: false,
      endlist: false,
      segments: [
        { type: 'segment', duration: 10, uri: '0.ts' },
        { type: 'segment', duration: 10, uri: '1.ts' },
        { type: 'segment', duration: 10, uri: '1945-muted.ts' },
        { type: 'segment', duration: 10, uri: '1946-muted.ts' },
      ],
    });
  });

  it('should parse media playlist (endlist)', () => {
    const result = hlsParser.parse(mocks.mediaPlaylistEndlist);
    assert.deepStrictEqual((result as hlsParser.MediaPlaylist).endlist, true);
  });

  it('should parse media playlist with #EXT-X-DISCONTINUITY', () => {
    // prettier-ignore
    assert.deepStrictEqual(hlsParser.parse(mocks.mediaPlaylistWithDiscontinuity), {
      type: 'playlist',
      isMasterPlaylist: false,
      endlist: true,
      segments: [
        { type: 'segment', duration: 8.001, uri: 'transmux-0000000222-1alP.ts?start_offset=0&end_offset=257935' },
        { type: 'segment', duration: 8.003, uri: 'transmux-0000000223-H2c2.ts?start_offset=0&end_offset=222779' },
        { type: 'segment', duration: 7.936, uri: 'transmux-0000000224-jLDq.ts?start_offset=0&end_offset=247031' },
        { type: 'segment', duration: 8.001, uri: 'transmux-0000000000-FbCv.ts?start_offset=0&end_offset=301551' },
      ],
    });
  });
});
