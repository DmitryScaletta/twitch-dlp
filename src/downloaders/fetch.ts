import fs from 'node:fs';
import stream from 'node:stream';
import { RET_CODE } from '../constants.ts';

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
  gzip = true,
) => {
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Encoding': gzip ? 'deflate, gzip' : '' },
    });
    if (!res.ok) return RET_CODE.HTTP_RETURNED_ERROR;
    const fileStream = fs.createWriteStream(destPath, { flags: 'wx' });
    await stream.promises.finished(
      stream.Readable.fromWeb(res.body as any).pipe(fileStream),
    );
    return RET_CODE.OK;
  } catch (e) {
    return RET_CODE.UNKNOWN_ERROR;
  }
};
