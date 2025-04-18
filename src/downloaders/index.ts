import { setTimeout as sleep } from 'node:timers/promises';
import { DOWNLOADERS, RET_CODE } from '../constants.ts';
import type { Downloader } from '../types.ts';
import * as aria2c from './aria2c.ts';
import * as curl from './curl.ts';
import * as fetch from './fetch.ts';

const [ARIA2C, CURL, FETCH] = DOWNLOADERS;

export const downloadFile = async (
  downloader: Downloader,
  url: string,
  destPath: string,
  rateLimit?: string,
  gzip?: boolean,
  retries = 5,
) => {
  if (downloader === CURL) {
    return curl.downloadFile(url, destPath, retries, rateLimit, gzip);
  }
  for (let i = 0; i < retries; i += 1) {
    let retCode: number = RET_CODE.OK;
    if (downloader === ARIA2C) {
      retCode = await aria2c.downloadFile(url, destPath, rateLimit, gzip);
    }
    if (downloader === FETCH) {
      retCode = await fetch.downloadFile(url, destPath, rateLimit, gzip);
    }
    if (retCode === RET_CODE.OK) return retCode;
    await sleep(1000);
  }
  return RET_CODE.UNKNOWN_ERROR;
};

const IS_URLS_AVAILABLE_MAP = {
  [ARIA2C]: aria2c.isUrlsAvailable,
  [CURL]: curl.isUrlsAvailable,
  [FETCH]: fetch.isUrlsAvailable,
} as const;

export const isUrlsAvailable = async (downloader: Downloader, urls: string[]) =>
  IS_URLS_AVAILABLE_MAP[downloader](urls);
