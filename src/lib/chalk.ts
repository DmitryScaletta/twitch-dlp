// https://github.com/chalk/chalk/blob/main/source/vendor/ansi-styles/index.js
const styles = {
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
  },
} as const;

type Color = keyof typeof styles.color;

export const chalk = Object.entries(styles.color).reduce(
  (acc, [color, [open, close]]) => {
    acc[color as Color] = (s: string) => `\x1b[${open}m${s}\x1b[${close}m`;
    return acc;
  },
  {} as Record<Color, (s: string) => string>,
);
