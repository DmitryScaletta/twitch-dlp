import fs from 'node:fs';
import stream from 'node:stream';
import { RET_CODE } from '../constants.ts';
import { ThrottleTransform } from '../lib/throttleTransform.ts';

const WRONG_LIMIT_RATE_SYNTAX = 'Wrong --limit-rate syntax';
const RATE_LIMIT_MULTIPLIER: Record<string, number> = {
  B: 1,
  K: 1024,
  M: 1024 * 1024,
};

const parseRateLimit = (rateLimit: string) => {
  const m = rateLimit.match(/^(?<value>\d+(?:\.\d+)?)(?<unit>[KM])?$/i);
  if (!m) throw new Error(WRONG_LIMIT_RATE_SYNTAX);
  const { value, unit } = m.groups as { value: string; unit?: string };
  const v = Number.parseFloat(value);
  const u = unit ? unit.toUpperCase() : 'B';
  if (Number.isNaN(v)) throw new Error(WRONG_LIMIT_RATE_SYNTAX);
  const multiplier = RATE_LIMIT_MULTIPLIER[u];
  return Math.round(v * multiplier);
};

const isUrlsAvailableFetch = async (urls: string[], gzip: boolean) => {
  try {
    const responses = await Promise.all(
      urls.map((url) =>
        fetch(url, {
          headers: { 'Accept-Encoding': gzip ? 'deflate, gzip' : '' },
        }),
      ),
    );
    return responses.map((res) => res.ok);
  } catch (e) {
    return urls.map(() => false);
  }
};

export const isUrlsAvailable = async (urls: string[]) => {
  const [urlsNoGzip, urlsGzip] = await Promise.all([
    isUrlsAvailableFetch(urls, false),
    isUrlsAvailableFetch(urls, true),
  ]);
  return urls.map((_, i) => [urlsNoGzip[i], urlsGzip[i]] as const);
};

export const downloadFile = async (
  url: string,
  destPath: string,
  rateLimit?: string,
  gzip = true,
) => {
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Encoding': gzip ? 'deflate, gzip' : '' },
    });
    if (!res.ok) return RET_CODE.HTTP_RETURNED_ERROR;
    await stream.promises.pipeline(
      stream.Readable.fromWeb(res.body as any),
      rateLimit
        ? new ThrottleTransform(parseRateLimit(rateLimit))
        : new stream.PassThrough(),
      fs.createWriteStream(destPath, { flags: 'wx' }),
    );
    return RET_CODE.OK;
  } catch (e) {
    return RET_CODE.UNKNOWN_ERROR;
  }
};
