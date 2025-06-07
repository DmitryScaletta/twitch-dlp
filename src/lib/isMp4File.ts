import fsp from 'node:fs/promises';

export const isMp4File = async (filePath: string) => {
  const fd = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    await fd.read(buf, 0, buf.length, 0);
    return (
      buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70
    );
  } finally {
    await fd.close();
  }
};
