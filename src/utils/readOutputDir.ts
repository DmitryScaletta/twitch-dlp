import fsp from 'node:fs/promises';
import path from 'node:path';

export const readOutputDir = (outputPath: string) =>
  fsp.readdir(path.parse(outputPath).dir || '.');
