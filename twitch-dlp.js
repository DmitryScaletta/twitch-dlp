#!/usr/bin/env node

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const stream = require('node:stream');
const path = require('node:path');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const { setTimeout } = require('timers/promises');

const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const VOD_DOMAINS = [
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
const HELP = `
Download regular/sub-only/hidden twitch VODs from start during live broadcast

GitHub Repo: https://github.com/DmitryScaletta/twitch-dlp

Usage:
npx twitch-dlp LINK

Positional arguments:
LINK                        Link to the VOD or channel

Options:
-h, --help                  Show this help message and exit
-f, --format FORMAT         Select format to download
                            Available formats:
                            - best: best quality (default)
                            - FORMAT: select format by format_id
-F, --list-formats          List available formats and exit
-o, --output OUTPUT         Output filename template
                            Available template variables:
                            - %(title)s
                            - %(id)s
                            - %(ext)s
                            - %(description)s
                            - %(duration)s
                            - %(uploader)s
                            - %(uploader_id)s
                            - %(upload_date)s
                            - %(release_date)s
                            - %(view_count)s
--live-from-start           Download live streams from the start
--retry-streams DELAY       Retry fetching the list of available
                            streams until streams are found
                            while waiting DELAY second(s)
                            between each attempt
-r, --limit-rate RATE       Limit download rate to RATE
--keep-fragments            Keep fragments after downloading
--download-sections TEXT    Download specific part of the video.
                            Syntax: "*start_time-end_time".
                            Examples: "*0-12:34", "*3:14:15-inf"
                            A "*" prefix is for yt-dlp compatibility.
                            Negative timestamps and multiple
                            sections are not supported
--merge-fragments           Merge already downloaded fragments.
                            Example: "npx twitch-dlp FILENAME
                            --merge-fragments". FILENAME must match
                            the fragment names but without
                            ".part-FragN". Can't be used with other
                            options (except --download-sections)

Requires:
- ffmpeg
- curl (if using --limit-rate option)
- streamlink (if downloading by channel link without --live-from-start)
`;
const PRIVATE_VIDEO_INSTRUCTIONS =
  'This video might be hidden or sub-only. Follow this article to download it: https://github.com/DmitryScaletta/twitch-dlp/blob/master/DOWNLOAD_PRIVATE_VIDEOS.md';

const spawn = (command, args, silent = false) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args);
    if (!silent) {
      child.stdout.on('data', (data) => process.stdout.write(data));
      child.stderr.on('data', (data) => process.stderr.write(data));
    }
    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve(code));
  });

const downloadWithFetch = async (url, destPath) => {
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(destPath, { flags: 'wx' });
  await stream.promises.finished(
    stream.Readable.fromWeb(res.body).pipe(fileStream),
  );
};

const downloadWithCurl = async (url, destPath, rateLimit) => {
  const curlArgs = ['-o', destPath, '--limit-rate', rateLimit, url];
  const exitCode = await spawn('curl', curlArgs, true);
  if (exitCode !== 0) throw new Error(`Curl error. Exit code: ${exitCode}`);
};

const downloadAndRetry = async (url, destPath, rateLimit, retryCount = 10) => {
  const downloader = rateLimit ? downloadWithCurl : downloadWithFetch;
  for (const [i] of Object.entries(Array.from({ length: retryCount }))) {
    try {
      return await downloader(url, destPath, rateLimit);
    } catch (e) {
      console.error(e.message);
      console.warn(`Can't download a url. Retry ${i + 1}`);
    }
  }
};

const fetchText = async (url, description = 'metadata') => {
  console.log(`Downloading ${description}`);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.text();
  } catch (e) {
    console.error(`Unable to download ${description}`);
    return null;
  }
};

const fetchGql = async (body, resultKey, description = 'metadata') => {
  console.log(`Downloading ${description}`);
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Client-Id': CLIENT_ID },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data[resultKey];
  } catch (e) {
    console.error(`Unable to download ${description}`);
    return null;
  }
};

const getAccessToken = (type, id) => {
  const PARAM_NAMES = {
    video: 'id',
    stream: 'channelName',
  };
  const query = `{
    ${type}PlaybackAccessToken(
      ${PARAM_NAMES[type]}: "${id}"
      params: {
        platform: "web"
        playerBackend: "mediaplayer"
        playerType: "site"
      }
    ) {
      value
      signature
    }
  }`;
  return fetchGql(
    { query },
    `${type}PlaybackAccessToken`,
    `${type} access token`,
  );
};

const getStreamMetadata = (channelLogin) =>
  fetchGql(
    {
      operationName: 'StreamMetadata',
      variables: {
        channelLogin: channelLogin,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            '252a46e3f5b1ddc431b396e688331d8d020daec27079893ac7d4e6db759a7402',
        },
      },
    },
    'user',
    'stream metadata',
  );

const getVideoMetadata = (videoId) =>
  fetchGql(
    {
      operationName: 'VideoMetadata',
      variables: {
        channelLogin: '',
        videoID: videoId,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            '45111672eea2e507f8ba44d101a61862f9c56b11dee09a15634cb75cb9b9084d',
        },
      },
    },
    'video',
    'video metadata',
  );

const getBroadcast = (channelId) =>
  fetchGql(
    {
      operationName: 'FFZ_BroadcastID',
      variables: {
        id: channelId,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            'cc89dfe8fcfe71235313b05b34799eaa519d162ebf85faf0c51d17c274614f0f',
        },
      },
    },
    'user',
    'broadcast id',
  );

const getContentMetadata = (login) =>
  fetchGql(
    {
      operationName: 'NielsenContentMetadata',
      variables: {
        isCollectionContent: false,
        isLiveContent: true,
        isVODContent: false,
        collectionID: '',
        login: login,
        vodID: '',
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            '2dbf505ee929438369e68e72319d1106bb3c142e295332fac157c90638968586',
        },
      },
    },
    'user',
    'content metadata',
  );

const getManifest = (videoId, accessToken) => {
  const params = new URLSearchParams({
    allow_source: 'true',
    allow_audio_only: 'true',
    allow_spectre: 'true',
    player: 'twitchweb',
    playlist_include_framerate: 'true',
    sig: accessToken.signature,
    token: accessToken.value,
  });
  const url = `https://usher.ttvnw.net/vod/${videoId}.m3u8?${params}`;
  return fetchText(url, 'video manifest');
};

const FORMATS_MAP = {
  chunked: 'Source',
  audio_only: 'Audio_Only',
};

const parseFormats = (manifest) => {
  // https://regex101.com/r/rRj5MT/2
  const FORMATS_REGEX =
    /(?:RESOLUTION=([^,]+),)?VIDEO="([^"]+)"[^\s]*\s(https[^\s]+)/g;
  const formats = [];
  let m;
  while (true) {
    m = FORMATS_REGEX.exec(manifest);
    if (m === null) break;
    const [width, height] = m[1] ? m[1].split('x') : [null, null];
    formats.push({
      format_id: FORMATS_MAP[m[2]] || m[2],
      width,
      height,
      url: m[3],
    });
  }
  return formats;
};

const getVideoFormats = async (videoId) => {
  const accessToken = await getAccessToken('video', videoId);
  if (!accessToken) return [];
  const manifest = await getManifest(videoId, accessToken);
  if (!manifest) return [];
  const formats = parseFormats(manifest);
  formats.sort((a, b) => b.width - a.width);
  return formats;
};

const getFullVodPath = (vodPath) => {
  const hashedVodPath = crypto
    .createHash('sha1')
    .update(vodPath)
    .digest('hex')
    .slice(0, 20);
  return `${hashedVodPath}_${vodPath}`;
};

const getVodUrl = (
  vodDomain,
  fullVodPath,
  broadcastType = 'ARCHIVE',
  videoId = '',
  resolution = 'chunked',
) => {
  const playlistName =
    broadcastType === 'HIGHLIGHT' ? `highlight-${videoId}` : 'index-dvr';
  return `${vodDomain}/${fullVodPath}/${resolution}/${playlistName}.m3u8`;
};

const getAvailableFormats = async (
  vodDomain,
  fullVodPath,
  broadcastType,
  videoId,
) => {
  const RESOLUTIONS = [
    'chunked',
    '720p60',
    '720p30',
    '480p30',
    '360p30',
    '160p30',
    'audio_only',
  ];
  const formats = [];
  const responses = await Promise.all(
    RESOLUTIONS.map((resolution) => {
      const url = getVodUrl(
        vodDomain,
        fullVodPath,
        broadcastType,
        videoId,
        resolution,
      );
      return fetch(url, { method: 'HEAD' });
    }),
  );
  for (const [i, res] of responses.entries()) {
    if (!res.ok) continue;
    const resolution = RESOLUTIONS[i];
    formats.push({
      format_id: FORMATS_MAP[resolution] || resolution,
      url: getVodUrl(resolution),
    });
  }
  return formats;
};

const getVideoFormatsByFullVodPath = async (
  fullVodPath,
  broadcastType,
  videoId,
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

const getVideoFormatsByThumbUrl = (broadcastType, videoId, thumbUrl) => {
  // thumb subdomain is not always the same as playlist subdomain
  // https://regex101.com/r/t8lsxY/1
  const THUMB_REGEX =
    /cf_vods\/(?<subdomain>[^\/]+)\/(?<fullVodPath>(?:[^\/]+|[^\/]+\/[^\/]+\/[^\/]+))\/?\/thumb\//;
  const m = thumbUrl.match(THUMB_REGEX);
  if (!m) return [];
  return getVideoFormatsByFullVodPath(
    m.groups.fullVodPath,
    broadcastType,
    videoId,
  );
};

const parseDownloadSectionsArg = (downloadSectionsArg) => {
  if (!downloadSectionsArg) return null;
  const DOWNLOAD_SECTIONS_ERROR = 'Wrong --download-sections syntax';
  // https://regex101.com/r/d0kteE/1
  const DOWNLOAD_SECTIONS_REGEX =
    /^\*(?:(?:(?<startH>\d{1,2}):)?(?<startM>\d{1,2}):)?(?:(?<startS>\d{1,2}))-(?:(?:(?:(?<endH>\d{1,2}):)?(?<endM>\d{1,2}):)?(?:(?<endS>\d{1,2}))|(?<inf>inf))$/;
  const m = downloadSectionsArg.match(DOWNLOAD_SECTIONS_REGEX);
  if (!m) throw new Error(DOWNLOAD_SECTIONS_ERROR);
  const {
    groups: { startH, startM, startS, endH, endM, endS, inf },
  } = m;
  const startHN = startH ? Number.parseInt(startH) : 0;
  const startMN = startM ? Number.parseInt(startM) : 0;
  const startSN = startS ? Number.parseInt(startS) : 0;
  const endHN = endH ? Number.parseInt(endH) : 0;
  const endMN = endM ? Number.parseInt(endM) : 0;
  const endSN = endS ? Number.parseInt(endS) : 0;
  if (startMN >= 60 || startSN >= 60 || endMN >= 60 || endSN >= 60) {
    throw new Error(DOWNLOAD_SECTIONS_ERROR);
  }
  const startTime = startSN + startMN * 60 + startHN * 60 * 60;
  const endTime = inf ? Infinity : endSN + endMN * 60 + endHN * 60 * 60;
  if (startTime >= endTime) throw new Error(DOWNLOAD_SECTIONS_ERROR);
  return { startTime, endTime };
};

const parseFrags = (url, content, downloadSections) => {
  const EXTINF = '#EXTINF:';
  const lines = content
    .split('\n')
    .filter((line) => line.startsWith(EXTINF) || !line.startsWith('#'))
    .filter(Boolean);
  const baseUrl = url.split('/').slice(0, -1).join('/');
  const frags = [];
  let offset = 0;
  let idx = 0;
  for (let i = 0; i < lines.length; i += 2) {
    const duration = lines[i].slice(EXTINF.length).split(',')[0];
    const url = `${baseUrl}/${lines[i + 1]}`;
    frags.push({ idx, offset, duration, url });
    offset += Number.parseFloat(duration);
    idx += 1;
  }
  if (!downloadSections) return frags;
  const { startTime, endTime } = downloadSections;
  const firstFragIdx = frags.findLastIndex((frag) => frag.offset <= startTime);
  const lastFragIdx =
    endTime === Infinity
      ? frags.length - 1
      : frags.findIndex((frag) => frag.offset >= endTime);
  return frags.slice(firstFragIdx, lastFragIdx + 1);
};

const getPlaylistFilename = (filename) => `${filename}-playlist.txt`;
const getFfconcatFilename = (filename) => `${filename}-ffconcat.txt`;
const getFragFilename = (filename, i) => `${filename}.part-Frag${i}`;

const showProgress = (frags, fragsMetadata, i) => {
  const COLOR = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
  };
  const fragsFullSize = fragsMetadata.reduce((acc, f) => acc + f.size, 0);
  const avgFragSize = fragsFullSize / fragsMetadata.length;
  const last5frags = fragsMetadata.slice(-5);
  const currentSpeedBps =
    last5frags.map((f) => (f.size / f.time) * 1000).reduce((a, b) => a + b, 0) /
    last5frags.length;

  const estFullSize = avgFragSize * frags.length;
  const estDownloadedSize = avgFragSize * (i + 1);
  const estSizeLeft = estFullSize - estDownloadedSize;
  let estTimeLeftSec = estSizeLeft / currentSpeedBps;
  let downloadedPercent = estDownloadedSize / estFullSize;

  if (estTimeLeftSec < 0 || Number.isNaN(estTimeLeftSec)) estTimeLeftSec = 0;
  if (downloadedPercent > 1) downloadedPercent = 1;

  const getValueAndUnit = (n) => {
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'];
    const i = n == 0 ? 0 : Math.floor(Math.log(n) / Math.log(1024));
    const value = n / Math.pow(1024, i);
    return { value, unit: units[i] };
  };

  const estSize = getValueAndUnit(estFullSize || 0);
  const currentSpeed = getValueAndUnit(currentSpeedBps || 0);

  const LOCALE = 'en-US';
  const progress = [
    `[download]${COLOR.cyan}`,
    new Intl.NumberFormat(LOCALE, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
      .format(downloadedPercent || 0)
      .padStart(6, ' '),
    `${COLOR.reset}of ~`,
    new Intl.NumberFormat(LOCALE, {
      notation: 'compact',
      style: 'unit',
      unit: estSize.unit,
      unitDisplay: 'narrow',
    })
      .format(estSize.value)
      .padStart(9, ' '),
    `at${COLOR.green}`,
    new Intl.NumberFormat(LOCALE, {
      notation: 'compact',
      style: 'unit',
      unit: `${currentSpeed.unit}-per-second`,
      unitDisplay: 'narrow',
    })
      .format(currentSpeed.value)
      .padStart(11, ' '),
    `${COLOR.reset}ETA${COLOR.yellow}`,
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZone: 'GMT',
    }).format((estTimeLeftSec || 0) * 1000),
    `${COLOR.reset}(frag ${i}/${frags.length})\r`,
  ].join(' ');
  process.stdout.write(progress);
};

const getStreamInfo = (channel, channelLogin) => ({
  id: channel.stream.id,
  title: channel.lastBroadcast.title || 'Untitled Broadcast',
  uploader: channelLogin,
  uploader_id: channel.id,
  upload_date: channel.stream.createdAt,
  release_date: channel.stream.createdAt,
  ext: 'mp4',
});

const getVideoInfo = (video) => ({
  id: `v${video.id}`,
  title: video.title || 'Untitled Broadcast',
  description: video.description,
  duration: video.lengthSeconds,
  uploader: video.owner.displayName,
  uploader_id: video.owner.login,
  upload_date: video.createdAt,
  release_date: video.publishedAt,
  view_count: video.viewCount,
  ext: 'mp4',
});

const getOutputFilename = (template, info) => {
  let outputFilename = template;
  for (const [name, value] of Object.entries(info)) {
    let newValue = value;
    if (name.endsWith('_date')) newValue = newValue.slice(0, 10);
    outputFilename = outputFilename.replaceAll(`%(${name})s`, newValue);
  }
  return path.resolve('.', outputFilename.replace(/[/\\?%*:|"'<>]/g, ''));
};

const downloadWithStreamlink = async (link, channel, channelLogin, args) => {
  const getDefaultOutputTemplate = () => {
    const now = new Date()
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')
      .replace(':', '_');
    return `%(uploader)s (live) ${now} [%(id)s].%(ext)s`;
  };

  if (args.values['list-formats']) {
    await spawn('streamlink', ['-v', link]);
    process.exit();
  }

  const outputFilename = getOutputFilename(
    args.values.output || getDefaultOutputTemplate(),
    getStreamInfo(channel, channelLogin),
  );

  const streamlinkArgs = [
    '-o',
    outputFilename,
    link,
    args.values.format,
    '--twitch-disable-ads',
  ];
  return spawn('streamlink', streamlinkArgs);
};

// https://github.com/ScrubN/TwitchDownloader/blob/master/TwitchDownloaderCore/VideoDownloader.cs#L337
const runFfconcat = (ffconcatFilename, outputFilename) =>
  // prettier-ignore
  spawn('ffmpeg', [
    '-avoid_negative_ts', 'make_zero',
    '-analyzeduration', '2147483647',
    '-probesize', '2147483647',
    '-max_streams', '2147483647',
    '-n',
    '-f', 'concat',
    '-safe', '0',
    '-i', ffconcatFilename,
    '-c', 'copy',
    outputFilename,
  ]);

const mergeFrags = async (frags, outputFilename, keepFragments) => {
  // https://github.com/ScrubN/TwitchDownloader/blob/master/TwitchDownloaderCore/Tools/FfmpegConcatList.cs#L30-L35
  let ffconcat = 'ffconcat version 1.0\n';
  ffconcat += frags
    .map((frag) =>
      [
        `file '${getFragFilename(outputFilename, frag.idx + 1)}'`,
        'stream',
        'exact_stream_id 0x100', // audio
        'stream',
        'exact_stream_id 0x101', // video
        'stream',
        'exact_stream_id 0x102', // subtitles
        `duration ${frag.duration}`,
      ].join('\n'),
    )
    .join('\n');
  const ffconcatFilename = getFfconcatFilename(outputFilename);
  await fsp.writeFile(ffconcatFilename, ffconcat);

  await runFfconcat(ffconcatFilename, outputFilename);

  fsp.unlink(ffconcatFilename);
  if (!keepFragments) {
    await Promise.all([
      ...frags.map((frag) =>
        fsp.unlink(getFragFilename(outputFilename, frag.idx + 1)),
      ),
      fsp.unlink(getPlaylistFilename(outputFilename)),
    ]);
  }
};

const downloadVideo = async (formats, videoInfo, getIsLive, args) => {
  const DEFAULT_OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s';
  const WAIT_BETWEEN_CYCLES_SECONDS = 60;

  if (args.values['list-formats']) {
    console.table(formats.map(({ url, ...rest }) => rest));
    process.exit();
  }

  const downloadFormat =
    args.values.format === 'best'
      ? formats[0]
      : formats.find((f) => f.format_id === args.values.format);
  if (!downloadFormat) throw new Error('Wrong format');
  const downloadSections = parseDownloadSectionsArg(
    args.values['download-sections'],
  );

  let outputFilename;
  let playlistFilename;
  let isLive;
  let frags;
  let fragsCount = 0;
  const fragsMetadata = [];
  while (true) {
    let playlist;
    [playlist, isLive] = await Promise.all([
      fetchText(downloadFormat.url, 'playlist'),
      getIsLive(),
    ]);
    if (!playlist) {
      console.log(
        `Can't fetch playlist. Retry after ${WAIT_BETWEEN_CYCLES_SECONDS} second(s)`,
      );
      await setTimeout(WAIT_BETWEEN_CYCLES_SECONDS * 1000);
      continue;
    }
    frags = parseFrags(downloadFormat.url, playlist, downloadSections);
    if (!outputFilename) {
      outputFilename = getOutputFilename(
        args.values.output || DEFAULT_OUTPUT_TEMPLATE,
        videoInfo,
      );
      playlistFilename = getPlaylistFilename(outputFilename);
    }
    await fsp.writeFile(playlistFilename, playlist);

    const hasNewFrags = frags.length > fragsCount;
    fragsCount = frags.length;
    if (!hasNewFrags && isLive) {
      console.log(
        `Waiting for new segments, retrying every ${WAIT_BETWEEN_CYCLES_SECONDS} second(s)`,
      );
      await setTimeout(WAIT_BETWEEN_CYCLES_SECONDS * 1000);
      continue;
    }

    let downloadedFragments = 0;
    for (let [i, frag] of frags.entries()) {
      const fragFilename = path.resolve(
        '.',
        getFragFilename(outputFilename, frag.idx + 1),
      );
      const fragFilenameTmp = `${fragFilename}.part`;
      if (fs.existsSync(fragFilename)) continue;
      showProgress(frags, fragsMetadata, i + 1);
      if (fs.existsSync(fragFilenameTmp)) {
        await fsp.unlink(fragFilenameTmp);
      }

      if (frag.url.endsWith('-unmuted.ts')) {
        frag.url = frag.url.replace('-unmuted.ts', '-muted.ts');
      }

      const startTime = Date.now();
      await downloadAndRetry(
        frag.url,
        fragFilenameTmp,
        args.values['limit-rate'],
      );
      const endTime = Date.now();
      await fsp.rename(fragFilenameTmp, fragFilename);
      const { size } = await fsp.stat(fragFilename);
      fragsMetadata.push({ size, time: endTime - startTime });
      downloadedFragments += 1;
    }
    if (downloadedFragments) process.stdout.write('\n');

    if (!isLive) break;
  }

  await mergeFrags(frags, outputFilename, args.values['keep-fragments']);
};

const parseLink = (link) => {
  const VOD_REGEX = /^https:\/\/(?:www\.)?twitch\.tv\/videos\/(\d+)/;
  const CHANNEL_REGEX = /^https:\/\/(?:www\.)?twitch\.tv\/([^/#?]+)/;

  let m = VOD_REGEX.exec(link);
  if (m) return { linkType: 'video', linkId: m[1] };
  m = CHANNEL_REGEX.exec(link);
  if (m) return { linkType: 'channel', linkId: m[1] };
  throw new Error('Wrong link');
};

const main = async () => {
  const args = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      format: {
        type: 'string',
        short: 'f',
        default: 'best',
      },
      'list-formats': {
        type: 'boolean',
        short: 'F',
        default: false,
      },
      output: {
        type: 'string',
        short: 'o',
      },
      'keep-fragments': {
        type: 'boolean',
        default: false,
      },
      'limit-rate': {
        type: 'string',
        short: 'r',
      },
      'live-from-start': {
        type: 'boolean',
      },
      'retry-streams': {
        type: 'string',
      },
      'download-sections': {
        type: 'string',
      },
      'merge-fragments': {
        type: 'boolean',
      },
    },
    allowPositionals: true,
  });

  if (args.values.help || args.positionals.length === 0) {
    console.log(HELP);
    return;
  }

  if (args.values['merge-fragments']) {
    const [filename] = args.positionals;
    const [playlist, allFiles] = await Promise.all([
      fsp.readFile(getPlaylistFilename(filename), 'utf8'),
      fsp.readdir(path.parse(filename).dir || '.'),
    ]);
    const frags = parseFrags(
      '',
      playlist,
      parseDownloadSectionsArg(args.values['download-sections']),
    );
    const existingFrags = frags.filter((frag) => {
      const fragFilename = getFragFilename(filename, frag.idx + 1);
      return allFiles.includes(path.parse(fragFilename).base);
    });
    await mergeFrags(existingFrags, filename, true);
    return;
  }

  if (args.values['retry-streams']) {
    const delay = Number.parseInt(args.values['retry-streams']);
    args.values['retry-streams'] = delay;
    if (!delay || delay < 0) throw new Error('Wrong retry streams delay');
  }
  if (args.positionals.length > 1) throw new Error('Expected only one link');

  const [link] = args.positionals;
  if (link.startsWith('video:')) {
    const vodPath = link.replace('video:', '');
    const formats = await getVideoFormatsByFullVodPath(getFullVodPath(vodPath));
    const [channelLogin, videoId, startTimestamp] = vodPath.split('_');
    const videoInfo = {
      id: videoId,
      title: `${channelLogin}_${startTimestamp}`,
      ext: 'mp4',
    };
    return downloadVideo(formats, videoInfo, () => false, args);
  }
  const { linkType, linkId } = parseLink(link);

  if (linkType === 'video') {
    let formats;
    let video;
    [formats, video] = await Promise.all([
      getVideoFormats(linkId),
      getVideoMetadata(linkId),
    ]);

    // should work for sub only VODs and highlights
    if (formats.length === 0 && video !== null) {
      console.log('Trying to get playlist url from video metadata');
      formats = await getVideoFormatsByThumbUrl(
        video.broadcastType,
        video.id,
        video.previewThumbnailURL,
      );
    }
    if (formats.length === 0) return console.log(PRIVATE_VIDEO_INSTRUCTIONS);
    return downloadVideo(formats, getVideoInfo(video), () => false, args);
  }

  const WAIT_AFTER_STREAM_ENDED_SECONDS = 8 * 60;

  const channelLogin = linkId;
  const retryStreamsDelay = args.values['retry-streams'];
  const isLiveFromStart = args.values['live-from-start'];
  while (true) {
    const channel = await getStreamMetadata(channelLogin);

    if (!channel?.stream) {
      if (retryStreamsDelay) {
        console.log(
          `Waiting for streams, retrying every ${retryStreamsDelay} second(s)`,
        );
        await setTimeout(retryStreamsDelay * 1000);
        continue;
      }
      throw new Error('The channel is not currently live');
    }

    if (isLiveFromStart) {
      let formats;
      let videoInfo;
      let videoId;

      const broadcast = await getBroadcast(channel.id);
      if (broadcast.stream.archiveVideo) {
        // public VOD
        videoId = broadcast.stream.archiveVideo.id;
        [formats, videoInfo] = await Promise.all([
          getVideoFormats(videoId),
          videoInfo || getVideoMetadata(videoId).then(getVideoInfo),
        ]);
      }

      if (!broadcast.stream.archiveVideo || formats.length === 0) {
        // private VOD
        console.warn(
          "Couldn't find an archived video for the current broadcast. Trying to recover VOD url",
        );
        let contentMetadata;
        const startTimestamp =
          new Date(channel.stream.createdAt).getTime() / 1000;
        const vodPath = `${channelLogin}_${channel.stream.id}_${startTimestamp}`;
        [formats, contentMetadata] = await Promise.all([
          getVideoFormatsByFullVodPath(getFullVodPath(vodPath)),
          getContentMetadata(channelLogin),
        ]);
        videoInfo = {
          id: `v${channel.stream.id}`,
          title:
            contentMetadata?.broadcastSettings?.title || 'Untitled Broadcast',
          description: '',
          duration: 0,
          uploader: channelLogin,
          uploader_id: channelLogin,
          upload_date: channel.stream.createdAt,
          release_date: channel.stream.createdAt,
          view_count: 0,
          ext: 'mp4',
        };
      }

      // To be able to download full vod we need to wait about 5 minutes after the end of the stream
      let streamId = broadcast.stream.id;
      let lastLiveTimestamp = Date.now();
      const getIsVodLive = (video) =>
        /\/404_processing_[^.?#]+\.png/.test(video.previewThumbnailURL);
      const getSecondsAfterStreamEnded = (video) => {
        const started = new Date(video.publishedAt);
        const ended = new Date(started.getTime() + video.lengthSeconds * 1000);
        return Math.floor((Date.now() - ended.getTime()) / 1000);
      };
      const getIsLive = async () => {
        let video;
        if (videoId) {
          video = await getVideoMetadata(videoId);
          const isLive = !video || getIsVodLive(video);
          if (isLive) return true;
          const secondsAfterEnd = getSecondsAfterStreamEnded(video);
          return WAIT_AFTER_STREAM_ENDED_SECONDS - secondsAfterEnd > 0;
        }
        if (!videoId || !video) {
          const broadcast = await getBroadcast(channel.id);
          if (!broadcast.stream || broadcast.stream.id !== streamId) {
            const secondsAfterEnd = (Date.now() - lastLiveTimestamp) / 1000;
            return WAIT_AFTER_STREAM_ENDED_SECONDS - secondsAfterEnd > 0;
          } else {
            lastLiveTimestamp = Date.now();
            return true;
          }
        }
      };

      if (formats.length === 0) {
        const VIDEO_NOT_FOUND_MESSAGE = "Couldn't find VOD url";
        if (retryStreamsDelay) {
          console.warn(VIDEO_NOT_FOUND_MESSAGE);
          console.log(
            `Waiting for VOD, retrying every ${retryStreamsDelay} second(s)`,
          );
          await setTimeout(retryStreamsDelay * 1000);
          continue;
        }
        throw new Error(VIDEO_NOT_FOUND_MESSAGE);
      }

      await downloadVideo(formats, videoInfo, getIsLive, args);
    }

    if (!isLiveFromStart) {
      const channelLink = `https://www.twitch.tv/${channelLogin}`;
      await downloadWithStreamlink(channelLink, channel, channelLogin, args);
    }

    if (!retryStreamsDelay) break;
  }
};

// main().catch((e) => console.error(e.message));
main().catch((e) => {
  throw e;
});
