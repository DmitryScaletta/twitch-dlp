import fsp from 'node:fs/promises';

export const showVersion = async () => {
  const pkg = await fsp.readFile('./package.json', 'utf8');
  console.log(JSON.parse(pkg).version);
};
