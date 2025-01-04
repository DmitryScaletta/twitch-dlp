import fsp from 'node:fs/promises';
import { spawn } from '../lib/spawn.ts';
import type { Frag } from '../types.ts';
import { getPath } from './getPath.ts';

export type FragFile = [filename: string, duration: string];

// https://github.com/ScrubN/TwitchDownloader/blob/master/TwitchDownloaderCore/VideoDownloader.cs#L337
const runFfconcat = (ffconcatFilename: string, outputFilename: string) =>
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

// https://github.com/ScrubN/TwitchDownloader/blob/master/TwitchDownloaderCore/Tools/FfmpegConcatList.cs#L30-L35
const generateFfconcat = (files: FragFile[]) => {
  let ffconcat = 'ffconcat version 1.0\n';
  ffconcat += files
    .map(([file, duration]) =>
      [
        `file '${file}'`,
        'stream',
        'exact_stream_id 0x100', // audio
        'stream',
        'exact_stream_id 0x101', // video
        'stream',
        'exact_stream_id 0x102', // subtitles
        `duration ${duration}`,
      ].join('\n'),
    )
    .join('\n');
  return ffconcat;
};

export const mergeFrags = async (
  frags: Frag[],
  outputPath: string,
  keepFragments: boolean,
) => {
  const fragFiles: FragFile[] = frags.map((frag) => [
    getPath.frag(outputPath, frag.idx + 1),
    frag.duration,
  ]);
  const ffconcat = generateFfconcat(fragFiles);
  const ffconcatPath = getPath.ffconcat(outputPath);
  await fsp.writeFile(ffconcatPath, ffconcat);

  const returnCode = await runFfconcat(ffconcatPath, outputPath);
  fsp.unlink(ffconcatPath);

  if (keepFragments || returnCode) return;

  await Promise.all([
    ...fragFiles.map(([filename]) => fsp.unlink(filename)),
    fsp.unlink(getPath.playlist(outputPath)),
  ]);
};
