import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from '../lib/spawn.ts';
import type { Frag } from '../types.ts';
import { getPath } from './getPath.ts';

export const processUnmutedFrags = async (
  frags: Frag[],
  outputPath: string,
  dir: string[],
  onSuccess: (frag: Frag) => void = () => {},
  onFailure: (frag: Frag) => void = () => {},
) => {
  for (const frag of frags) {
    const fragPath = getPath.frag(outputPath, frag.idx + 1);
    const fragUnmutedPath = getPath.fragUnmuted(fragPath);
    const fragUnmutedFileName = path.parse(fragUnmutedPath).base;
    if (!dir.includes(fragUnmutedFileName)) continue;

    const fragUnmutedPathTmp = `${fragPath}.ts`;
    // prettier-ignore
    const retCode = await spawn('ffmpeg', [
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

    const message = `[unmute] Adding audio to Frag${frag.idx + 1}`;

    if (retCode) {
      try {
        await fsp.unlink(fragUnmutedPathTmp);
      } catch {}
      console.error(`${message}. Failure`);
      onFailure(frag);
      continue;
    }

    await Promise.all([fsp.unlink(fragPath), fsp.unlink(fragUnmutedPath)]);
    await fsp.rename(fragUnmutedPathTmp, fragPath);

    console.log(`${message}. Success`);
    onSuccess(frag);
  }
};
