import fsp from 'node:fs/promises';
import { MERGE_METHODS } from '../constants.ts';
import { chalk } from '../lib/chalk.ts';
import type { Frags, MergeMethod } from '../types.ts';
import { getPath } from '../utils/getPath.ts';
import * as append from './append.ts';
import * as ffconcat from './ffconcat.ts';

export type FragFile = [filename: string, duration: number];

const [FFCONCAT, APPEND] = MERGE_METHODS;

export const mergeFrags = async (
  method: MergeMethod,
  frags: Frags,
  outputPath: string,
  keepFragments: boolean,
) => {
  if (frags.length === 0) {
    console.error(`${chalk.red('ERROR:')} No fragments were downloaded`);
    return 1;
  }

  if (method === FFCONCAT && frags.isFMp4) {
    console.warn(
      `${chalk.yellow('WARN:')} ${FFCONCAT} merge method is not supported for fMP4 streams. Using ${APPEND} instead`,
    );
    method = APPEND;
  }

  const fragFiles: FragFile[] = frags.map((frag) => [
    getPath.frag(outputPath, frag.idx + 1),
    frag.duration,
  ]);

  let retCode: number;
  switch (method) {
    case FFCONCAT:
      retCode = await ffconcat.mergeFrags(fragFiles, outputPath);
      break;
    case APPEND:
      retCode = await append.mergeFrags(fragFiles, outputPath);
      break;
    default:
      throw new Error();
  }

  let keepFrags = keepFragments;
  if (retCode) {
    console.warn(
      `${chalk.yellow('WARN:')} Keeping fragments because merging failed with code ${retCode}`,
    );
    keepFrags = true;
  }

  if (!keepFrags) {
    await Promise.all([
      ...fragFiles.map(([filename]) => fsp.unlink(filename)),
      fsp.unlink(getPath.playlist(outputPath)),
    ]);
  }

  return retCode;
};
