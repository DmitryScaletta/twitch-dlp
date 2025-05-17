import fsp from 'node:fs/promises';
import path from 'node:path';

export const showHelp = async () => {
  const readmePath = path.resolve(import.meta.dirname, 'README.md');
  const readme = await fsp.readFile(readmePath, 'utf8');
  const entries = readme.split(/\s## (.*)/g).slice(1);
  const sections: Record<string, string> = {};
  for (let i = 0; i < entries.length; i += 2) {
    const header = entries[i];
    const content = entries[i + 1].trim();
    sections[header] = content;
  }
  const help = [
    'Options:',
    sections.Options.replace(/^```\w+\n(.*)\n```$/s, '$1'),
    '',
    'Dependencies:',
    sections.Dependencies.replaceAll('**', ''),
  ];
  console.log(help.join('\n'));
};
