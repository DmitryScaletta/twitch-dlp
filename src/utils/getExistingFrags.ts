import path from 'node:path';
import type { Frag } from '../types.ts';
import { getPath } from './getPath.ts';

export const getExistingFrags = (
  frags: Frag[],
  outputPath: string,
  dir: string[],
) =>
  frags.filter((frag) =>
    dir.includes(path.parse(getPath.frag(outputPath, frag.idx + 1)).base),
  );
