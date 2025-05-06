import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as m3u8 from './m3u8.ts';

const playlist1080p60 = `#EXTM3U
#EXT-X-TWITCH-INFO:ORIGIN="s3",B="false",REGION="EU",USER-IP="178.120.55.186",SERVING-ID="f583721afd5e475188145b5dd6ccd8a6",CLUSTER="cloudfront_vod",USER-COUNTRY="BY",MANIFEST-CLUSTER="cloudfront_vod"
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="chunked",NAME="1080p60",AUTOSELECT=NO,DEFAULT=NO
#EXT-X-STREAM-INF:BANDWIDTH=8440947,CODECS="avc1.640032,mp4a.40.2",RESOLUTION=1920x1080,VIDEO="chunked",FRAME-RATE=60.000
https://d1m7jfoe9zdc1j.cloudfront.net/8bc45f9ebd1d857c8d90_lirik_52800169245_1735405554/chunked/index-dvr.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="720p60",NAME="720p60",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=3429119,CODECS="avc1.4D0020,mp4a.40.2",RESOLUTION=1280x720,VIDEO="720p60",FRAME-RATE=60.000
https://d1m7jfoe9zdc1j.cloudfront.net/8bc45f9ebd1d857c8d90_lirik_52800169245_1735405554/720p60/index-dvr.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="480p30",NAME="480p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=1471157,CODECS="avc1.4D001F,mp4a.40.2",RESOLUTION=852x480,VIDEO="480p30",FRAME-RATE=30.000
https://d1m7jfoe9zdc1j.cloudfront.net/8bc45f9ebd1d857c8d90_lirik_52800169245_1735405554/480p30/index-dvr.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="360p30",NAME="360p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=737995,CODECS="avc1.4D001E,mp4a.40.2",RESOLUTION=640x360,VIDEO="360p30",FRAME-RATE=30.000
https://d1m7jfoe9zdc1j.cloudfront.net/8bc45f9ebd1d857c8d90_lirik_52800169245_1735405554/360p30/index-dvr.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="160p30",NAME="160p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=287650,CODECS="avc1.4D000C,mp4a.40.2",RESOLUTION=284x160,VIDEO="160p30",FRAME-RATE=30.000
https://d1m7jfoe9zdc1j.cloudfront.net/8bc45f9ebd1d857c8d90_lirik_52800169245_1735405554/160p30/index-dvr.m3u8`;

const playlistMuted = `#EXTM3U
#EXT-X-TWITCH-INFO:ORIGIN="s3",B="false",REGION="EU",USER-IP="178.120.55.186",SERVING-ID="8bc087d8c7604fccb35a26d62bfc20fc",CLUSTER="cloudfront_vod",USER-COUNTRY="BY",MANIFEST-CLUSTER="cloudfront_vod"
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="chunked",NAME="1080p60",AUTOSELECT=NO,DEFAULT=NO
#EXT-X-STREAM-INF:BANDWIDTH=8440571,CODECS="avc1.640032,mp4a.40.2",RESOLUTION=1920x1080,VIDEO="chunked",FRAME-RATE=60.000
https://d1m7jfoe9zdc1j.cloudfront.net/0e740a6c0aae94e24d3e_lirik_52810336845_1735491842/chunked/index-muted-0T1A17C8FG.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="720p60",NAME="720p60",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=3429926,CODECS="avc1.4D0020,mp4a.40.2",RESOLUTION=1280x720,VIDEO="720p60",FRAME-RATE=60.000
https://d1m7jfoe9zdc1j.cloudfront.net/0e740a6c0aae94e24d3e_lirik_52810336845_1735491842/720p60/index-muted-0T1A17C8FG.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="480p30",NAME="480p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=1471923,CODECS="avc1.4D001F,mp4a.40.2",RESOLUTION=852x480,VIDEO="480p30",FRAME-RATE=30.000
https://d1m7jfoe9zdc1j.cloudfront.net/0e740a6c0aae94e24d3e_lirik_52810336845_1735491842/480p30/index-muted-0T1A17C8FG.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="360p30",NAME="360p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=737678,CODECS="avc1.4D001E,mp4a.40.2",RESOLUTION=640x360,VIDEO="360p30",FRAME-RATE=30.000
https://d1m7jfoe9zdc1j.cloudfront.net/0e740a6c0aae94e24d3e_lirik_52810336845_1735491842/360p30/index-muted-0T1A17C8FG.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="160p30",NAME="160p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=288445,CODECS="avc1.4D000C,mp4a.40.2",RESOLUTION=284x160,VIDEO="160p30",FRAME-RATE=30.000
https://d1m7jfoe9zdc1j.cloudfront.net/0e740a6c0aae94e24d3e_lirik_52810336845_1735491842/160p30/index-muted-0T1A17C8FG.m3u8`;

const playlist1440pWithAudioOnly = `#EXTM3U
#EXT-X-TWITCH-INFO:ORIGIN="s3",B="false",REGION="EU",USER-IP="178.120.55.186",SERVING-ID="76737597db6e4d9c958b5f618f2249df",CLUSTER="cloudfront_vod",USER-COUNTRY="BY",MANIFEST-CLUSTER="cloudfront_vod"
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="chunked",NAME="1440p",AUTOSELECT=NO,DEFAULT=NO
#EXT-X-STREAM-INF:BANDWIDTH=6356993,CODECS="avc1.640032,mp4a.40.2",RESOLUTION=2560x1440,VIDEO="chunked",FRAME-RATE=30.000
https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/chunked/index-dvr.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="720p30",NAME="720p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=2367665,CODECS="avc1.4D001F,mp4a.40.2",RESOLUTION=1280x720,VIDEO="720p30",FRAME-RATE=30.000
https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/720p30/index-dvr.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="480p30",NAME="480p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=1452306,CODECS="avc1.4D001F,mp4a.40.2",RESOLUTION=852x480,VIDEO="480p30",FRAME-RATE=30.000
https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/480p30/index-dvr.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="audio_only",NAME="Audio Only",AUTOSELECT=NO,DEFAULT=NO
#EXT-X-STREAM-INF:BANDWIDTH=196037,CODECS="mp4a.40.2",VIDEO="audio_only"
https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/audio_only/index-dvr.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="360p30",NAME="360p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=736068,CODECS="avc1.4D001E,mp4a.40.2",RESOLUTION=640x360,VIDEO="360p30",FRAME-RATE=30.000
https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/360p30/index-dvr.m3u8
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="160p30",NAME="160p",AUTOSELECT=YES,DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=296388,CODECS="avc1.4D000C,mp4a.40.2",RESOLUTION=284x160,VIDEO="160p30",FRAME-RATE=30.000
https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/160p30/index-dvr.m3u8`;

const vod = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#ID3-EQUIV-TDTG:2024-12-29T23:36:07
#EXT-X-PLAYLIST-TYPE:EVENT
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-TWITCH-ELAPSED-SECS:0.000
#EXT-X-TWITCH-TOTAL-SECS:23510.000
#EXTINF:10.000,
0.ts
#EXTINF:10.000,
1.ts
#EXT-X-ENDLIST`;

const vodWithMuted = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#ID3-EQUIV-TDTG:2024-12-29T23:36:07
#EXT-X-PLAYLIST-TYPE:EVENT
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-TWITCH-ELAPSED-SECS:0.000
#EXT-X-TWITCH-TOTAL-SECS:23510.000
#EXTINF:10.000,
0.ts
#EXTINF:10.000,
1.ts
#EXTINF:10.000,
1945-muted.ts
#EXTINF:10.000,
1946-muted.ts
#EXT-X-ENDLIST`;

const vodWithDiscontinuity = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#ID3-EQUIV-TDTG:2016-02-20T23:38:02
#EXT-X-PLAYLIST-TYPE:EVENT

#EXT-X-TWITCH-ELAPSED-SECS:0.0
#EXT-X-TWITCH-TOTAL-SECS:2296.76
#EXTINF:8.001,
transmux-0000000222-1alP.ts?start_offset=0&end_offset=257935
#EXTINF:8.003,
transmux-0000000223-H2c2.ts?start_offset=0&end_offset=222779
#EXTINF:7.936,
transmux-0000000224-jLDq.ts?start_offset=0&end_offset=247031
#EXT-X-DISCONTINUITY
#EXTINF:8.001,
transmux-0000000000-FbCv.ts?start_offset=0&end_offset=301551
#EXT-X-DISCONTINUITY
#EXT-X-ENDLIST
`;

describe('m3u8', () => {
  it('should parse all segments', () => {
    assert.equal(m3u8.parsePlaylist(playlist1080p60).length, 5);
  });

  it('should parse attributes', () => {
    assert.deepStrictEqual(m3u8.parsePlaylist(playlistMuted)[0], {
      groupId: 'chunked',
      name: '1080p60',
      width: 1920,
      height: 1080,
      bandwidth: 8440571,
      codecs: 'avc1.640032,mp4a.40.2',
      frameRate: 60,
      url: 'https://d1m7jfoe9zdc1j.cloudfront.net/0e740a6c0aae94e24d3e_lirik_52810336845_1735491842/chunked/index-muted-0T1A17C8FG.m3u8',
    });
  });

  it('should parse attributes for audio', (t) => {
    assert.deepStrictEqual(m3u8.parsePlaylist(playlist1440pWithAudioOnly)[3], {
      groupId: 'audio_only',
      name: 'Audio Only',
      width: null,
      height: null,
      bandwidth: 196037,
      codecs: 'mp4a.40.2',
      frameRate: null,
      url: 'https://dgeft87wbj63p.cloudfront.net/899085d30a9339109158_pajlada_43465171160_1735466631/audio_only/index-dvr.m3u8',
    });
  });

  it('should parse VODs', () => {
    assert.deepStrictEqual(m3u8.parseVod(vod), [
      { duration: '10.000', url: '0.ts' },
      { duration: '10.000', url: '1.ts' },
    ]);
  });

  it('should parse VODs with muted segments', () => {
    assert.deepStrictEqual(m3u8.parseVod(vodWithMuted), [
      { duration: '10.000', url: '0.ts' },
      { duration: '10.000', url: '1.ts' },
      { duration: '10.000', url: '1945-muted.ts' },
      { duration: '10.000', url: '1946-muted.ts' },
    ]);
  });

  it('should parse VODs with #EXT-X-DISCONTINUITY', () => {
    // prettier-ignore
    assert.deepStrictEqual(m3u8.parseVod(vodWithDiscontinuity), [
      { duration: '8.001', url: 'transmux-0000000222-1alP.ts?start_offset=0&end_offset=257935' },
      { duration: '8.003', url: 'transmux-0000000223-H2c2.ts?start_offset=0&end_offset=222779' },
      { duration: '7.936', url: 'transmux-0000000224-jLDq.ts?start_offset=0&end_offset=247031' },
      { duration: '8.001', url: 'transmux-0000000000-FbCv.ts?start_offset=0&end_offset=301551' },
    ]);
  });
});
