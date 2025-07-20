import path from 'node:path';
import type { VideoInfo } from '../types.ts';

const ILLEGAL_PATH_CHARS_MAP: Record<string, string> = {
  '\\': '⧹',
  '/': '⧸',
  ':': '：',
  '*': '＊',
  '?': '？',
  '"': '＂',
  '<': '＜',
  '>': '＞',
  '|': '｜',
};

const sanitizeFilename = (str: string) => {
  const chars = Object.keys(ILLEGAL_PATH_CHARS_MAP);
  const regex = `[${chars.map((c) => (c === '\\' ? '\\\\' : c)).join('')}]`;
  return str.replace(new RegExp(regex, 'g'), (c) => ILLEGAL_PATH_CHARS_MAP[c]);
};

const getOutputPath = (template: string, videoInfo: VideoInfo) => {
  let outputPath = template;
  for (const [key, value] of Object.entries(videoInfo)) {
    let newValue = value ? `${value}` : '';
    if (key.endsWith('_date')) newValue = newValue.slice(0, 10);
    newValue = sanitizeFilename(newValue);
    outputPath = outputPath.replaceAll(`%(${key})s`, newValue);
  }
  return path.resolve(outputPath);
};

export const getPath = {
  output: getOutputPath,
  ffconcat: (filePath: string) => `${filePath}-ffconcat.txt`,
  playlist: (filePath: string) => `${filePath}-playlist.m3u8`,
  log: (filePath: string) => `${filePath}-log.tsv`,
  frag: (filePath: string, i: number) => `${filePath}.part-Frag${i}`,
  fragUnmuted: (fragPath: string) => `${fragPath}-unmuted`,
};
