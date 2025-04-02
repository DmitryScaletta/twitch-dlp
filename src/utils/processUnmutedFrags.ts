import path from 'node:path';
import fsp from 'node:fs/promises';
import { spawn } from '../lib/spawn.ts';
import { getPath } from './getPath.ts';
import type { Frag } from '../types.ts';

export const processUnmutedFrags = async (
  frags: Frag[],
  outputPath: string,
  _dir?: string[],
) => {
  const dir = _dir || (await fsp.readdir(path.parse(outputPath).dir));

  for (const frag of frags) {
    const fragPath = getPath.frag(outputPath, frag.idx + 1);
    const fragUnmutedPath = getPath.fragUnmuted(fragPath);
    const fragUnmutedFileName = path.parse(fragUnmutedPath).base;
    if (!dir.includes(fragUnmutedFileName)) continue;

    const fragUnmutedPathTmp = `${fragPath}.ts`;
    // prettier-ignore
    const returnCode = await spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', fragPath,
      '-i', fragUnmutedPath,
      '-c:a', 'copy',
      '-c:v', 'copy',
      '-map', '1:a:0',
      '-map', '0:v:0',
      '-y',
      fragUnmutedPathTmp,
    ]);

    const message = `[unmute] Adding audio in Frag${frag.idx + 1}`;

    if (returnCode) {
      try {
        await fsp.unlink(fragUnmutedPathTmp);
      } catch {}
      console.error(`${message}. Failure`);
      continue;
    }

    await Promise.all([fsp.unlink(fragPath), fsp.unlink(fragUnmutedPath)]);
    await fsp.rename(fragUnmutedPathTmp, fragPath);

    console.log(`${message}. Success`);
  }
};
