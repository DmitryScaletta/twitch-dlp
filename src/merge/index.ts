import { MERGE_METHODS } from '../constants.ts';
import { chalk } from '../lib/chalk.ts';
import type { Frags, MergeMethod } from '../types.ts';
import * as append from './append.ts';
import * as ffconcat from './ffconcat.ts';

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

  if (frags.isFMp4) {
    console.warn(
      `${chalk.yellow('WARN:')} ${FFCONCAT} merge method is not supported for fMP4 streams. Using ${APPEND} instead`,
    );
  }

  if (method === APPEND || frags.isFMp4) {
    return append.mergeFrags(frags, outputPath, keepFragments);
  }

  if (method === FFCONCAT) {
    return ffconcat.mergeFrags(frags, outputPath, keepFragments);
  }

  throw new Error();
};
