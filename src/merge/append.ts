import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from '../lib/spawn.ts';
import type { FragFile } from './index.ts';

const concatFrags = async (files: string[], outputPath: string) => {
  const writeStream = fs.createWriteStream(outputPath, { flags: 'w' });
  try {
    for (const file of files) {
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(file);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', reject);
      });
    }
  } catch (error) {
    throw error;
  } finally {
    writeStream.end();
  }
};

export const mergeFrags = async (fragFiles: FragFile[], outputPath: string) => {
  await concatFrags(
    fragFiles.map(([filename]) => filename),
    outputPath,
  );

  const parsed = path.parse(outputPath);
  const outputPathTmp = path.join(parsed.dir, `${parsed.name}.temp.mp4`);

  // fixup
  // prettier-ignore
  const retCode = await spawn('ffmpeg', [
    '-y',
    '-loglevel', 'repeat+info',
    '-i', `file:${outputPath}`,
    '-map', '0',
    '-dn',
    '-ignore_unknown',
    '-c', 'copy',
    '-f', 'mp4',
    '-bsf:a', 'aac_adtstoasc',
    '-movflags', '+faststart',
    `file:${outputPathTmp}`,
  ]);

  await fsp.unlink(outputPath);
  await fsp.rename(outputPathTmp, outputPath);

  return retCode;
};
