import { setTimeout as sleep } from 'timers/promises';
import type { Downloader } from '../types.ts';
import { DOWNLOADERS } from '../constants.ts';
import * as aria2c from './aria2c.ts';
import * as curl from './curl.ts';
import * as fetch from './fetch.ts';

const [ARIA2C, CURL, FETCH] = DOWNLOADERS;

export const downloadFile = async (
  downloader: Downloader,
  url: string,
  destPath: string,
  rateLimit: string | undefined,
  gzip?: boolean,
  retries = 5,
) => {
  if (downloader === CURL) {
    return curl.downloadFile(url, destPath, retries, rateLimit, gzip);
  }
  for (const [i] of Object.entries(Array.from({ length: retries }))) {
    let success = false;
    if (downloader === ARIA2C) {
      success = await aria2c.downloadFile(url, destPath, rateLimit, gzip);
    }
    if (downloader === FETCH) {
      success = await fetch.downloadFile(url, destPath, gzip);
    }
    if (success) return true;
    sleep(1000);
    console.error(`Can't download a url. Retry ${i + 1}`);
  }
  throw new Error('Unknown downloader');
};

const IS_URLS_AVAILABLE_MAP = {
  [ARIA2C]: aria2c.isUrlsAvailable,
  [CURL]: curl.isUrlsAvailable,
  [FETCH]: fetch.isUrlsAvailable,
} as const;

export const isUrlsAvailable = async (downloader: Downloader, urls: string[]) =>
  IS_URLS_AVAILABLE_MAP[downloader](urls);
