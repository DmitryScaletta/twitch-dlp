import childProcess from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RET_CODE } from '../constants.ts';

const isUrlsAvailableAria2c = (
  urls: string[],
  urlsPath: string,
  gzip: boolean,
): Promise<boolean[]> =>
  new Promise((resolve) => {
    // prettier-ignore
    const args: string[] = [
      '--dry-run',
      '--console-log-level', 'error',
      '-i', urlsPath,
    ];
    if (gzip) args.push('--http-accept-gzip');
    const child = childProcess.spawn('aria2c', args);
    let data = '';
    child.stdout.on('data', (chunk) => (data += chunk));
    child.on('error', () => resolve([]));
    child.on('close', () => {
      const matches = data.matchAll(/Exception:.*URI=(?<uri>\S+)/g);
      const notAvailableUrls: string[] = [];
      for (const m of matches) notAvailableUrls.push(m.groups!.uri);
      resolve(urls.map((url) => !notAvailableUrls.includes(url)));
    });
  });

export const isUrlsAvailable = async (
  urls: string[],
): Promise<[noGzip: boolean, gzip: boolean][]> => {
  const urlsPath = path.resolve(os.tmpdir(), `aria2c-urls-${Date.now()}.txt`);
  await fsp.writeFile(urlsPath, urls.join('\n'));
  const [urlsNoGzip, urlsGzip] = await Promise.all([
    isUrlsAvailableAria2c(urls, urlsPath, false),
    isUrlsAvailableAria2c(urls, urlsPath, true),
  ]);
  await fsp.unlink(urlsPath);
  return urls.map((_, i) => [urlsNoGzip[i], urlsGzip[i]] as const);
};

// https://aria2.github.io/manual/en/html/aria2c.html#exit-status
export const downloadFile = async (
  url: string,
  destPath: string,
  rateLimit = '0',
  gzip = false,
): Promise<number> =>
  new Promise((resolve) => {
    const dest = path.parse(destPath);
    // prettier-ignore
    const args: string[] = [
      '--console-log-level', 'error',
      '--max-overall-download-limit', rateLimit,
      '--dir', dest.dir,
      '-o', dest.base,
      url,
    ]
    if (gzip) args.push('--http-accept-gzip');
    const child = childProcess.spawn('aria2c', args);
    child.on('error', () => resolve(RET_CODE.UNKNOWN_ERROR));
    child.on('close', (code) => resolve(code || RET_CODE.OK));
  });
