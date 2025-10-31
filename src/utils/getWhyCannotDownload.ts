import fsp from 'node:fs/promises';
import path from 'node:path';

export const getWhyCannotDownload = async () => {
  try {
    const mdPath = path.resolve(
      import.meta.dirname,
      'DOWNLOAD_PRIVATE_VIDEOS.md',
    );
    const md = await fsp.readFile(mdPath, 'utf8');
    const txt = [];
    for (const m of md.matchAll(/> (.*:|- .*)/gm)) txt.push(m[1]);
    return txt.join('\n');
  } catch {
    return '';
  }
};
