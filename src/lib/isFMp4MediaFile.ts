import fsp from 'node:fs/promises';

export const isFMp4MediaFile = async (filePath: string) => {
  const fd = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(4096);
    await fd.read(buf, 0, buf.length, 0);
    const hasMoof = buf.includes(Buffer.from('moof'));
    const hasMdat = buf.includes(Buffer.from('mdat'));
    return hasMoof && hasMdat;
  } finally {
    await fd.close();
  }
};
