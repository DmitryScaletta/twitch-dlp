import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { setTimeout as sleep } from 'timers/promises';
import type { AppArgs } from '../main.ts';
import type { DownloadFormat, FragMetadata, VideoInfo } from '../types.ts';
import { fetchText } from './fetchText.ts';
import { getFragsForDownloading } from './getFragsForDownloading.ts';
import { getPath } from './getPath.ts';
import { showProgress } from './showProgress.ts';
import { downloadAndRetry } from '../downloaders.ts';
import { mergeFrags } from './mergeFrags.ts';

const DEFAULT_OUTPUT_TEMPLATE = '%(title)s [%(id)s].%(ext)s';
const WAIT_BETWEEN_CYCLES_SECONDS = 60;

export const downloadVideo = async (
  formats: DownloadFormat[],
  videoInfo: VideoInfo,
  getIsLive: () => boolean | Promise<boolean>,
  args: AppArgs,
) => {
  if (args.values['list-formats']) {
    console.table(formats.map(({ url, ...rest }) => rest));
    process.exit();
  }

  const downloadFormat =
    args.values.format === 'best'
      ? formats[0]
      : formats.find((f) => f.format_id === args.values.format);
  if (!downloadFormat) throw new Error('Wrong format');

  const outputPath = getPath.output(
    args.values.output || DEFAULT_OUTPUT_TEMPLATE,
    videoInfo,
  );
  let isLive;
  let frags;
  let fragsCount = 0;
  const fragsMetadata: FragMetadata[] = [];
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
      await sleep(WAIT_BETWEEN_CYCLES_SECONDS * 1000);
      continue;
    }
    frags = getFragsForDownloading(
      downloadFormat.url,
      playlist,
      args.values['download-sections'],
    );

    await fsp.writeFile(getPath.playlist(outputPath), playlist);

    const hasNewFrags = frags.length > fragsCount;
    fragsCount = frags.length;
    if (!hasNewFrags && isLive) {
      console.log(
        `Waiting for new segments, retrying every ${WAIT_BETWEEN_CYCLES_SECONDS} second(s)`,
      );
      await sleep(WAIT_BETWEEN_CYCLES_SECONDS * 1000);
      continue;
    }

    let downloadedFragments = 0;
    for (let [i, frag] of frags.entries()) {
      const fragPath = getPath.frag(outputPath, frag.idx + 1);
      const fragTmpPath = `${fragPath}.part`;
      if (fs.existsSync(fragPath)) continue;
      showProgress(frags, fragsMetadata, i + 1);
      if (fs.existsSync(fragTmpPath)) {
        await fsp.unlink(fragTmpPath);
      }

      if (frag.url.endsWith('-unmuted.ts')) {
        frag.url = frag.url.replace('-unmuted.ts', '-muted.ts');
      }

      const startTime = Date.now();
      await downloadAndRetry(frag.url, fragTmpPath, args.values['limit-rate']);
      const endTime = Date.now();
      await fsp.rename(fragTmpPath, fragPath);
      const { size } = await fsp.stat(fragPath);
      fragsMetadata.push({ size, time: endTime - startTime });
      downloadedFragments += 1;
    }
    if (downloadedFragments) process.stdout.write('\n');

    if (!isLive) break;
  }

  await mergeFrags(frags, outputPath, args.values['keep-fragments']);
};
