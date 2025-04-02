import fsp from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { RET_CODE } from '../constants.ts';
import { downloadFile } from '../downloaders/index.ts';
import { isInstalled } from '../lib/isInstalled.ts';
import { statsOrNull } from '../lib/statsOrNull.ts';
import type { AppArgs } from '../main.ts';
import { mergeFrags } from '../merge/index.ts';
import type {
  Downloader,
  DownloadFormat,
  FragMetadata,
  VideoInfo,
} from '../types.ts';
import { fetchText } from './fetchText.ts';
import { getExistingFrags } from './getExistingFrags.ts';
import { getFragsForDownloading } from './getFragsForDownloading.ts';
import { getPath } from './getPath.ts';
import { getUnmutedFrag } from './getUnmutedFrag.ts';
import { processUnmutedFrags } from './processUnmutedFrags.ts';
import { readOutputDir } from './readOutputDir.ts';
import { showProgress } from './showProgress.ts';

const DEFAULT_OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s';
const WAIT_BETWEEN_CYCLES_SEC = 60;

const downloadFrag = async (
  downloader: Downloader,
  url: string,
  destPath: string,
  limitRateArg?: string,
  gzip?: boolean,
) => {
  const destPathTmp = `${destPath}.part`;
  if (await statsOrNull(destPathTmp)) await fsp.unlink(destPathTmp);
  const startTime = Date.now();
  const retCode = await downloadFile(
    downloader,
    url,
    destPathTmp,
    limitRateArg,
    gzip,
  );
  const endTime = Date.now();
  if (retCode !== RET_CODE.OK) {
    try {
      await fsp.unlink(destPathTmp);
    } catch {}
    return { size: 0, time: 0 };
  }
  await fsp.rename(destPathTmp, destPath);
  const { size } = await fsp.stat(destPath);
  return { size, time: endTime - startTime };
};

const isVideoOlderThat24h = (videoInfo: VideoInfo) => {
  const videoDate = videoInfo.upload_date || videoInfo.release_date;
  if (!videoDate) return null;
  const now = Date.now();
  const videoDateMs = new Date(videoDate).getTime();
  return now - videoDateMs > 24 * 60 * 60 * 1000;
};

export const downloadVideo = async (
  formats: DownloadFormat[],
  videoInfo: VideoInfo,
  getIsFinalized: () => boolean | Promise<boolean>,
  args: AppArgs,
) => {
  if (args['list-formats']) {
    console.log(formats[0].url);
    console.table(formats.map(({ url, ...rest }) => rest));
    process.exit();
  }

  if (!(await isInstalled('ffmpeg'))) {
    throw new Error(
      'ffmpeg is not installed. Install it from https://ffmpeg.org/',
    );
  }

  const dlFormat =
    args.format === 'best'
      ? formats[0]
      : formats.find((f) => f.format_id === args.format);
  if (!dlFormat) throw new Error('Wrong format');

  const outputPath = getPath.output(
    args.output || DEFAULT_OUTPUT_TEMPLATE,
    videoInfo,
  );
  let isFinalized;
  let frags;
  let fragsCount = 0;
  let playlistUrl = dlFormat.url;
  const downloadedFrags: FragMetadata[] = [];
  while (true) {
    let playlist;
    [playlist, isFinalized] = await Promise.all([
      fetchText(playlistUrl, 'playlist'),
      getIsFinalized(),
    ]);
    // workaround for some old muted highlights
    if (!playlist) {
      const newPlaylistUrl = dlFormat.url.replace(/-muted-\w+(?=\.m3u8$)/, '');
      if (newPlaylistUrl !== playlistUrl) {
        playlistUrl = newPlaylistUrl;
        playlist = await fetchText(playlistUrl, 'playlist (attempt #2)');
      }
    }
    if (!playlist) {
      console.warn(
        `Cannot download the playlist. Retry every ${WAIT_BETWEEN_CYCLES_SEC} second(s)`,
      );
      await sleep(WAIT_BETWEEN_CYCLES_SEC * 1000);
      continue;
    }
    frags = getFragsForDownloading(
      playlistUrl,
      playlist,
      args['download-sections'],
    );

    await fsp.writeFile(getPath.playlist(outputPath), playlist);

    const hasNewFrags = frags.length > fragsCount;
    fragsCount = frags.length;
    if (!hasNewFrags && !isFinalized) {
      console.log(
        `No new fragments. Retry every ${WAIT_BETWEEN_CYCLES_SEC} second(s)`,
      );
      await sleep(WAIT_BETWEEN_CYCLES_SEC * 1000);
      continue;
    }

    let downloadedFragments = 0;
    for (const [i, frag] of frags.entries()) {
      showProgress(downloadedFrags, fragsCount);

      const fragPath = getPath.frag(outputPath, frag.idx + 1);
      const fragStats = await statsOrNull(fragPath);
      if (fragStats) {
        if (!downloadedFrags[i]) {
          downloadedFrags[i] = { size: fragStats.size, time: 0 };
        }
        continue;
      }

      if (frag.url.endsWith('-unmuted.ts')) {
        frag.url = frag.url.replace('-unmuted', '-muted');
      }
      let unmutedFrag: Awaited<ReturnType<typeof getUnmutedFrag>> | null = null;
      if (frag.url.endsWith('-muted.ts') && !isVideoOlderThat24h(videoInfo)) {
        unmutedFrag = await getUnmutedFrag(
          args.downloader,
          args.unmute,
          frag.url,
          formats,
        );
      }

      let fragGzip: boolean | undefined = undefined;
      if (unmutedFrag && unmutedFrag.sameFormat) {
        frag.url = unmutedFrag.url;
        fragGzip = unmutedFrag.gzip;
      }
      const fragMeta = await downloadFrag(
        args.downloader,
        frag.url,
        fragPath,
        args['limit-rate'],
        fragGzip,
      );
      downloadedFrags.push(fragMeta);
      downloadedFragments += 1;

      if (unmutedFrag && !unmutedFrag.sameFormat) {
        await downloadFrag(
          args.downloader,
          unmutedFrag.url,
          getPath.fragUnmuted(fragPath),
          args['limit-rate'],
          unmutedFrag.gzip,
        );
      }

      showProgress(downloadedFrags, fragsCount);
    }
    if (downloadedFragments) process.stdout.write('\n');

    if (isFinalized) break;
  }

  const dir = await readOutputDir(outputPath);
  const existingFrags = getExistingFrags(frags, outputPath, dir);

  await processUnmutedFrags(existingFrags, outputPath, dir);
  await mergeFrags(
    args['merge-method'],
    existingFrags,
    outputPath,
    args['keep-fragments'],
  );
};
