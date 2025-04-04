import fsp from 'node:fs/promises';
import type { AppArgs } from '../main.ts';
import { mergeFrags } from '../merge/index.ts';
import { getExistingFrags } from '../utils/getExistingFrags.ts';
import { getFragsForDownloading } from '../utils/getFragsForDownloading.ts';
import { getPath } from '../utils/getPath.ts';
import { processUnmutedFrags } from '../utils/processUnmutedFrags.ts';
import { readOutputDir } from '../utils/readOutputDir.ts';

export const mergeFragments = async (outputPath: string, args: AppArgs) => {
  const [playlist, dir] = await Promise.all([
    fsp.readFile(getPath.playlist(outputPath), 'utf8'),
    readOutputDir(outputPath),
  ]);
  const frags = getFragsForDownloading('', playlist, args);
  const existingFrags = getExistingFrags(frags, outputPath, dir);
  await processUnmutedFrags(existingFrags, outputPath, dir);
  return mergeFrags(args['merge-method'], existingFrags, outputPath, true);
};
