import fsp from 'node:fs/promises';

export const unlinkIfAny = async (path: string) => {
  try {
    return await fsp.unlink(path);
  } catch {}
};
