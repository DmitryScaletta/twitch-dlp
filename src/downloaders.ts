import fs from 'node:fs';
import stream from 'node:stream';
import { spawn } from './lib/spawn.ts';

const downloadWithFetch = async (url: string, destPath: string) => {
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(destPath, { flags: 'wx' });
  await stream.promises.finished(
    // @ts-expect-error
    stream.Readable.fromWeb(res.body).pipe(fileStream),
  );
};

const downloadWithCurl = async (
  url: string,
  destPath: string,
  rateLimit: string,
) => {
  const curlArgs = ['-o', destPath, '--limit-rate', rateLimit, url];
  const exitCode = await spawn('curl', curlArgs, true);
  if (exitCode !== 0) throw new Error(`Curl error. Exit code: ${exitCode}`);
};

export const downloadAndRetry = async (
  url: string,
  destPath: string,
  rateLimit?: string,
  retryCount = 10,
) => {
  for (const [i] of Object.entries(Array.from({ length: retryCount }))) {
    try {
      return rateLimit
        ? await downloadWithCurl(url, destPath, rateLimit)
        : await downloadWithFetch(url, destPath);
    } catch (e: any) {
      console.error(e.message);
      console.warn(`Can't download a url. Retry ${i + 1}`);
    }
  }
};
