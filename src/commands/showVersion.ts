import fsp from 'node:fs/promises';
import path from 'node:path';

export const showVersion = async () => {
  const pkgPath = path.resolve(import.meta.dirname, 'package.json');
  const pkg = await fsp.readFile(pkgPath, 'utf8');
  console.log(JSON.parse(pkg).version);
};
