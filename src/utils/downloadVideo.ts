import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'timers/promises';
import type { AppArgs } from '../main.ts';
import type { DownloadFormat, FragMetadata, VideoInfo } from '../types.ts';
import { fetchText } from './fetchText.ts';
import { getFragsForDownloading } from './getFragsForDownloading.ts';
import { getFilename } from './getFilename.ts';
import { showProgress } from './showProgress.ts';
import { downloadAndRetry } from '../downloaders.ts';
import { mergeFrags } from './mergeFrags.ts';

export const downloadVideo = async (
  formats: DownloadFormat[],
  videoInfo: VideoInfo,
  getIsLive: () => boolean | Promise<boolean>,
  args: AppArgs,
) => {
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

  let outputFilename;
  let playlistFilename;
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
    if (!outputFilename || !playlistFilename) {
      outputFilename = getFilename.output(
        args.values.output || DEFAULT_OUTPUT_TEMPLATE,
        videoInfo,
      );
      playlistFilename = getFilename.playlist(outputFilename);
    }
    await fsp.writeFile(playlistFilename, playlist);

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
      const fragFilename = path.resolve(
        '.',
        getFilename.frag(outputFilename, frag.idx + 1),
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
