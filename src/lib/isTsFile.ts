import fsp from 'fs/promises';

const PACKET_SIZE = 188;
const TS_SYNC_BYTE = 0x47;

export const isTsFile = async (filePath: string, packetsToCheck = 1) => {
  const fd = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(PACKET_SIZE * packetsToCheck);
    const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
    if (bytesRead < PACKET_SIZE * packetsToCheck) return false;
    for (let i = 0; i < packetsToCheck; i += 1) {
      if (buf[i * PACKET_SIZE] !== TS_SYNC_BYTE) return false;
    }
    return true;
  } finally {
    await fd.close();
  }
};
