import fsp from 'node:fs/promises';

export const unlinkIfAny = (path: string) => {
  try {
    return fsp.unlink(path);
  } catch {}
};
