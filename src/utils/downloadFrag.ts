import fsp from 'node:fs/promises';
import { RET_CODE } from '../constants.ts';
import { downloadFile } from '../downloaders/index.ts';
import { isTsFile } from '../lib/isTsFile.ts';
import { statsOrNull } from '../lib/statsOrNull.ts';
import { unlinkIfAny } from '../lib/unlinkIfAny.ts';
import type { Downloader } from '../types.ts';

export const downloadFrag = async (
  downloader: Downloader,
  url: string,
  destPath: string,
  limitRateArg?: string,
  gzip?: boolean,
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
    isTsFile(destPath),
  ]);
  if (!isTs) {
    await fsp.unlink(destPath);
    return null;
  }

  return { size, time: endTime - startTime };
};
