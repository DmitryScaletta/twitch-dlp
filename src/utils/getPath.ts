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

const sanitizeFilename = (str: string) =>
  str.replace(/[\\/:*?"<>|]/g, (c) => ILLEGAL_PATH_CHARS_MAP[c]);

export const getPath = {
  output: (template: string, videoInfo: VideoInfo) => {
    let finalTemplate = template;
    for (const [name, value] of Object.entries(videoInfo)) {
      let newValue = value ? String(value) : '';
      if (name.endsWith('_date')) newValue = newValue.slice(0, 10);
      newValue = sanitizeFilename(newValue);
      finalTemplate = finalTemplate.replaceAll(`%(${name})s`, newValue);
    }
    return path.resolve(finalTemplate);
  },
  ffconcat: (filePath: string) => `${filePath}-ffconcat.txt`,
  playlist: (filePath: string) => `${filePath}-playlist.m3u8`,
  log: (filePath: string) => `${filePath}-log.tsv`,
  frag: (filePath: string, i: number) => `${filePath}.part-Frag${i}`,
  fragUnmuted: (fragPath: string) => `${fragPath}-unmuted`,
};
