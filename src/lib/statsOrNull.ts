import fsp from 'node:fs/promises';

export const statsOrNull = async (path: string) => {
  try {
    return await fsp.stat(path);
  } catch (e) {
    return null;
  }
};
