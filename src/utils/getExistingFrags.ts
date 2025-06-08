import path from 'node:path';
import type { Frags } from '../types.ts';
import { getPath } from './getPath.ts';

export const getExistingFrags = (
  frags: Frags,
  outputPath: string,
  dir: string[],
) => {
  const existingFrags = frags.filter((frag) =>
    dir.includes(path.parse(getPath.frag(outputPath, frag.idx + 1)).base),
  ) as Frags;
  existingFrags.isFMp4 = frags.isFMp4;
  return existingFrags;
};
