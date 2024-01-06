#!/usr/bin/env node

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const stream = require('node:stream');
const readline = require('node:readline');
const path = require('node:path');
const childProcess = require('node:child_process');
const { parseArgs } = require('node:util');
const { setTimeout } = require('timers/promises');

const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const HELP = `
Simple script for downloading twitch VODs from start during live broadcast.

GitHub Repo: https://github.com/DmitryScaletta/twitch-dl

Usage:
npx twitch-dl LINK

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
                            between each attempt.
-r, --limit-rate RATE       Limit download rate to RATE
--keep-fragments            Keep fragments after downloading

Requires:
- ffmpeg
- curl (if using --limit-rate option)
- streamlink (if downloading by channel link without --live-from-start)
`;

const spawn = (command, args, silent = false) =>
  new Promise((resolve) => {
    const child = childProcess.spawn(command, args);
    if (!silent) {
      child.stdout.on('data', (data) => process.stdout.write(data));
      child.stderr.on('data', (data) => process.stderr.write(data));
    }
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
  for (const i of Array.from({ length: retryCount })) {
    try {
      return downloader(url, destPath, rateLimit);
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
    return res.text();
  } catch (e) {
    console.error(`Unable to download ${description}`);
    throw e;
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
    const json = await res.json();
    return json.data[resultKey];
  } catch (e) {
    console.error(`Unable to download ${description}`);
    throw e;
  }
};

const getAccessToken = (type, id) => {
  const paramName = type === 'video' ? 'id' : 'channelName';
  const query = `{
    ${type}PlaybackAccessToken(
      ${paramName}: "${id}"
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
            'c25707c1e5176320ceac6b447d052480887e23bc794ca1d02becd0bcc91844fe',
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

const getManifest = (videoId, accessToken) => {
  const params = new URLSearchParams({
    allow_source: 'true',
    allow_audio_only: 'true',
    allow_spectre: 'true',
    player: 'twitchweb',
    playlist_include_framerate: 'true',
    nauth: accessToken.value,
    nauthsig: accessToken.signature,
  });
  const url = `https://usher.ttvnw.net/vod/${videoId}.m3u8?${params}`;
  return fetchText(url, 'video manifest');
};

const parseFormats = (manifest) => {
  // https://regex101.com/r/rRj5MT/2
  const FORMATS_REGEX =
    /(?:RESOLUTION=([^,]+),)?VIDEO="([^"]+)"[^\s]*\s(https[^\s]+)/g;
  const FORMATS_MAP = {
    chunked: 'Source',
    audio_only: 'Audio_Only',
  };
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
  const manifest = await getManifest(videoId, accessToken);
  const formats = parseFormats(manifest);
  formats.sort((a, b) => b.width - a.width);
  return formats;
};

const getFragments = async (url) => {
  const playlist = await fetchText(url, 'fragments list');
  const baseUrl = url.split('/').slice(0, -1).join('/');
  return playlist
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .filter(Boolean)
    .map((name) => `${baseUrl}/${name}`);
};

const showProgress = (frags, fragsMetadata, i) => {
  const fragsFullSize = fragsMetadata.reduce((acc, f) => acc + f.size, 0);
  const avgFragSize = fragsFullSize / fragsMetadata.length;
  const avgSpeedBytePerSec =
    fragsMetadata
      .map((f) => (f.size / f.time) * 1000)
      .reduce((a, b) => a + b, 0) / fragsMetadata.length;

  const estFullSize = avgFragSize * frags.length;
  const estDownloadedSize = avgFragSize * (frags.length - i);
  const estSizeLeft = estFullSize - estDownloadedSize;
  // TODO: fix this
  const estTimeLeftSec = estSizeLeft / avgSpeedBytePerSec;
  const downloadedPercent = 1 - estDownloadedSize / estFullSize;

  const getValueAndUnit = (n) => {
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'];
    const i = n == 0 ? 0 : Math.floor(Math.log(n) / Math.log(1024));
    const value = n / Math.pow(1024, i);
    return { value, unit: units[i] };
  };

  const estSize = getValueAndUnit(estFullSize || 0);
  const avgSpeed = getValueAndUnit(avgSpeedBytePerSec || 0);

  const LOCALE = 'en-US';
  const progress = [
    '[download]',
    new Intl.NumberFormat(LOCALE, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
      .format(downloadedPercent || 0)
      .padStart(6, ' '),
    'of ~',
    new Intl.NumberFormat(LOCALE, {
      notation: 'compact',
      style: 'unit',
      unit: estSize.unit,
      unitDisplay: 'narrow',
    })
      .format(estSize.value)
      .padStart(9, ' '),
    'at',
    new Intl.NumberFormat(LOCALE, {
      notation: 'compact',
      style: 'unit',
      unit: `${avgSpeed.unit}-per-second`,
      unitDisplay: 'narrow',
    })
      .format(avgSpeed.value)
      .padStart(11, ' '),
    'ETA',
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZone: 'GMT',
    }).format((estTimeLeftSec || 0) * 1000),
    `(frag ${i}/${frags.length})\r`,
  ].join(' ');
  process.stdout.write(progress);
};

const getSecondsAfterStreamEnded = (video) => {
  const started = new Date(video.publishedAt);
  const ended = new Date(started.getTime() + video.lengthSeconds * 1000);
  return Math.floor((Date.now() - ended.getTime()) / 1000);
};

const waitAfterStreamEnded = async (video, secondsToSleep = 0) => {
  const secondsAfterEnd = getSecondsAfterStreamEnded(video);
  const timeoutSeconds = secondsToSleep - secondsAfterEnd;
  if (timeoutSeconds < 0) return;
  const minutesAll = secondsToSleep / 60;
  const minutesLeft = (timeoutSeconds / 60).toFixed(1);
  console.log(
    `To be able to download full vod we need to wait at least ${minutesAll} minutes after the end of the stream.`,
  );
  console.log(`We need to wait ${minutesLeft} more minutes.`);
  console.log('Press any key to skip waiting.');
  const ac = new AbortController();
  const handleKeypress = (s, key) => {
    if (key.ctrl == true && key.name == 'c') process.exit();
    ac.abort();
  };
  const interface = readline.createInterface({ input: process.stdin });
  readline.emitKeypressEvents(process.stdin, interface);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', handleKeypress);
  try {
    await setTimeout(timeoutSeconds * 1000, null, { signal: ac.signal });
  } catch {}
  process.stdin.setRawMode(false);
  process.stdin.off('keypress', handleKeypress);
  interface.close();
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
  return path.resolve('.', outputFilename.replace(/[/\\?%*:|"<>]/g, ''));
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

const downloadVideo = async (videoId, args) => {
  const DEFAULT_OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s';
  const WAIT_AFTER_STREAM_ENDED_SECONDS = 5 * 60;
  const WAIT_BETWEEN_CYCLES_SECONDS = 60;

  const formats = await getVideoFormats(videoId);

  if (args.values['list-formats']) {
    console.table(formats.map(({ url, ...rest }) => rest));
    process.exit();
  }

  const downloadFormat =
    args.values.format === 'best'
      ? formats[0]
      : formats.find((f) => f.format_id === args.values.format);
  if (!downloadFormat) throw new Error('Wrong format');

  const getIsVodLive = (video) =>
    video.previewThumbnailURL.match(/\/404_processing_[^.?#]+\.png/);
  const getFragFilename = (filename, i) => `${filename}.part-Frag${i}`;

  let outputFilename;
  let video;
  let frags;
  const fragsMetadata = [];
  let isFinalCycle = null;
  while (true) {
    [frags, video] = await Promise.all([
      getFragments(downloadFormat.url),
      getVideoMetadata(videoId),
    ]);
    if (!outputFilename) {
      outputFilename = getOutputFilename(
        args.values.output || DEFAULT_OUTPUT_TEMPLATE,
        getVideoInfo(video),
      );
    }
    if (isFinalCycle === null) {
      isFinalCycle =
        !getIsVodLive(video) &&
        getSecondsAfterStreamEnded(video) > WAIT_AFTER_STREAM_ENDED_SECONDS;
    }
    let fragsDownloaded = 0;
    for (const [i, fragUrl] of frags.entries()) {
      const fragFilename = path.resolve(
        '.',
        getFragFilename(outputFilename, i),
      );
      const fragFilenameTmp = `${fragFilename}.part`;
      if (fs.existsSync(fragFilename)) continue;
      showProgress(frags, fragsMetadata, i + 1);
      if (fs.existsSync(fragFilenameTmp)) {
        await fsp.unlink(fragFilenameTmp);
      }
      const startTime = Date.now();
      await downloadAndRetry(
        fragUrl,
        fragFilenameTmp,
        args.values['limit-rate'],
      );
      const endTime = Date.now();
      await fsp.rename(fragFilenameTmp, fragFilename);
      const { size } = await fsp.stat(fragFilename);
      fragsMetadata.push({ size, time: endTime - startTime });
      fragsDownloaded += 1;
    }
    if (fragsDownloaded) process.stdout.write('\n');

    if (isFinalCycle) break;

    const isLive = getIsVodLive(video);
    if (isLive) {
      console.log(
        `Waiting for new segments, retrying every ${WAIT_BETWEEN_CYCLES_SECONDS} second(s)`,
      );
      await setTimeout(WAIT_BETWEEN_CYCLES_SECONDS * 1000);
    } else {
      isFinalCycle = true;
      await waitAfterStreamEnded(video, WAIT_AFTER_STREAM_ENDED_SECONDS);
    }
  }

  const fragFilenames = frags.map((_, i) => getFragFilename(outputFilename, i));
  const ffmpegList = fragFilenames
    .map((filename) => `file '${filename}'`)
    .join('\n');
  const ffmpegListFilename = `${outputFilename}-list.txt`;
  await fsp.writeFile(ffmpegListFilename, ffmpegList);
  const ffmpegArgs = [
    '-n',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    ffmpegListFilename,
    '-c',
    'copy',
    outputFilename,
  ];
  await spawn('ffmpeg', ffmpegArgs);

  fsp.unlink(ffmpegListFilename);
  if (!args.values['keep-fragments']) {
    await Promise.all(fragFilenames.map(fsp.unlink));
  }
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
    },
    allowPositionals: true,
  });

  if (args.values.help || args.positionals.length === 0) {
    console.log(HELP);
    return;
  }

  if (args.values['retry-streams']) {
    const delay = Number.parseInt(args.values['retry-streams']);
    args.values['retry-streams'] = delay;
    if (!delay || delay < 0) throw new Error('Wrong retry streams delay');
  }
  if (args.positionals.length > 1) throw new Error('Expected only one link');

  const [link] = args.positionals;
  const { linkType, linkId } = parseLink(link);

  if (linkType === 'video') return downloadVideo(linkId, args);

  const channelLogin = linkId;
  const retryStreamsDelay = args.values['retry-streams'];
  const isLiveFromStart = args.values['live-from-start'];
  while (true) {
    const channel = await getStreamMetadata(channelLogin);

    if (!channel.stream) {
      if (retryStreamsDelay) {
        console.log(
          `Waiting for streams, retrying every ${retryStreamsDelay} second(s)`,
        );
        await setTimeout(retryStreamsDelay * 1000);
        continue;
      } else {
        throw new Error('The channel is not currently live');
      }
    }

    if (isLiveFromStart) {
      const broadcast = await getBroadcast(channel.id);
      if (!broadcast.stream.archiveVideo) {
        const VIDEO_NOT_FOUND_MESSAGE =
          "Sorry, we couldn't find an archived video for the current broadcast";
        if (retryStreamsDelay) {
          console.warn(VIDEO_NOT_FOUND_MESSAGE);
          console.log(
            `Waiting for VOD, retrying every ${retryStreamsDelay} second(s)`,
          );
          await setTimeout(retryStreamsDelay * 1000);
          continue;
        } else {
          throw new Error(VIDEO_NOT_FOUND_MESSAGE);
        }
      }
      await downloadVideo(broadcast.stream.archiveVideo.id, args);
    }

    if (!isLiveFromStart) {
      const channelLink = `https://www.twitch.tv/${channelLogin}`;
      await downloadWithStreamlink(channelLink, channel, channelLogin, args);
    }

    if (!retryStreamsDelay) break;
  }
};

main().catch((e) => console.error(e.message));
