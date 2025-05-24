import childProcess from 'node:child_process';
import fsp from 'node:fs/promises';
import type { Frag } from '../types.ts';
import { getPath } from '../utils/getPath.ts';

const MAX_INT_STR = '2147483647';

type FragFile = [filename: string, duration: number];

const spawnFfmpeg = (args: string[]): Promise<number> =>
  new Promise((resolve, reject) => {
    let isInputSection = true;
    let prevLinePart = '';
    const handleFfmpegData = (stream: NodeJS.WriteStream) => (data: Buffer) => {
      if (!isInputSection) return stream.write(data);

      const lines = data.toString().split('\n');
      lines[0] = prevLinePart + lines[0];
      prevLinePart = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('  Stream #')) continue;
        if (line.startsWith('Stream mapping:')) isInputSection = false;
        stream.write(line + '\n');
      }

      if (!isInputSection) stream.write(prevLinePart);
    };

    const child = childProcess.spawn('ffmpeg', args);
    child.stdout.on('data', handleFfmpegData(process.stdout));
    child.stderr.on('data', handleFfmpegData(process.stderr));
    child.on('error', () => reject(1));
    child.on('close', (code) => resolve(code || 0));
  });

// https://github.com/lay295/TwitchDownloader/blob/master/TwitchDownloaderCore/VideoDownloader.cs#L393
const runFfconcat = (ffconcatFilename: string, outputFilename: string) =>
  // prettier-ignore
  spawnFfmpeg([
    '-hide_banner',
    '-avoid_negative_ts', 'make_zero',
    '-analyzeduration', MAX_INT_STR,
    '-probesize', MAX_INT_STR,
    '-max_streams', MAX_INT_STR,
    '-n',
    '-f', 'concat',
    '-safe', '0',
    '-i', ffconcatFilename,
    '-c', 'copy',
    outputFilename,
  ]);

// https://github.com/lay295/TwitchDownloader/blob/master/TwitchDownloaderCore/Tools/FfmpegConcatList.cs#L30-L35
const generateFfconcat = (files: FragFile[]) => {
  let ffconcat = 'ffconcat version 1.0\n';
  ffconcat += files
    .map(([file, duration]) =>
      [
        `file '${file.replaceAll("'", "'\\''")}'`,
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

  const retCode = await runFfconcat(ffconcatPath, outputPath);
  fsp.unlink(ffconcatPath);

  if (!keepFragments) {
    await Promise.all([
      ...fragFiles.map(([filename]) => fsp.unlink(filename)),
      fsp.unlink(getPath.playlist(outputPath)),
    ]);
  }

  return retCode;
};
