import * as ffconcat from './ffconcat.ts';
import * as append from './append.ts';
import type { Frag, MergeMethod } from '../types.ts';
import { MERGE_METHODS } from '../constants.ts';

const [FFCONCAT, APPEND] = MERGE_METHODS;

export const mergeFrags = async (
  method: MergeMethod,
  frags: Frag[],
  outputPath: string,
  keepFragments: boolean,
) => {
  if (method === FFCONCAT) {
    return ffconcat.mergeFrags(frags, outputPath, keepFragments);
  }

  if (method === APPEND) {
    return append.mergeFrags(frags, outputPath, keepFragments);
  }

  throw new Error(
    `Unknown merge method: ${method}. Available methods: ${MERGE_METHODS}`,
  );
};
