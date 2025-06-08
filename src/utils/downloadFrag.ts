import fsp from 'node:fs/promises';
import { RET_CODE } from '../constants.ts';
import { downloadFile } from '../downloaders/index.ts';
import { isFMp4MediaFile } from '../lib/isFMp4MediaFile.ts';
import { isMp4File } from '../lib/isMp4File.ts';
import { isTsFile } from '../lib/isTsFile.ts';
import { statsOrNull } from '../lib/statsOrNull.ts';
import { unlinkIfAny } from '../lib/unlinkIfAny.ts';
import type { Downloader } from '../types.ts';

type FragType = 'any' | 'ts' | 'mp4' | 'fmp4-map' | 'fmp4-media';

const CHECK_FILE_TYPE: Record<
  FragType,
  (path: string) => boolean | Promise<boolean>
> = {
  any: () => true,
  ts: isTsFile,
  mp4: isMp4File,
  'fmp4-map': isMp4File,
  'fmp4-media': isFMp4MediaFile,
};

export const downloadFrag = async (
  downloader: Downloader,
  url: string,
  destPath: string,
  limitRateArg?: string,
  gzip?: boolean,
  type: FragType = 'any',
) => {
  const destPathTmp = `${destPath}.part`;
  if (await statsOrNull(destPathTmp)) await fsp.unlink(destPathTmp);

  const startTime = Date.now();
  const retCode = await downloadFile(
    downloader,
    url,
    destPathTmp,
    limitRateArg,
    gzip,
  );
  const endTime = Date.now();

  if (retCode !== RET_CODE.OK) {
    await unlinkIfAny(destPathTmp);
    return null;
  }
  await fsp.rename(destPathTmp, destPath);
  const [{ size }, isTs] = await Promise.all([
    fsp.stat(destPath),
    CHECK_FILE_TYPE[type](destPath),
  ]);
  if (!isTs) {
    await fsp.unlink(destPath);
    return null;
  }

  return { size, time: endTime - startTime };
};
