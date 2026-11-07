/**
 * Build-time ASCII rendering of a painting for the wall's footer strip. A thin
 * horizontal slice of the image becomes rows of characters; the brightest
 * areas spell out the painting's title.
 */
import sharp from "sharp";

const RAMP = [" ", "·", ":", "-", "=", "+", "*", "o"];
const NOT_LETTER = /[^a-z]/g;

/** Brightness level 0–8 → tone: 0 dim, 1 mid, 2 the title's letters. */
const toneOf = (level: number): Run["tone"] => {
  if (level === 8) {
    return 2;
  }
  return level >= 4 ? 1 : 0;
};

/** Turns one row of brightness levels into runs of same-tone characters. */
const rowOf = (levels: number[], word: string, r: number) => {
  const runs: Run[] = [];
  for (const [c, level] of levels.entries()) {
    const char = level === 8 ? word[(c + r * 3) % word.length] : RAMP[level];
    const tone = toneOf(level);
    const prev = runs.at(-1);
    if (prev && prev.tone === tone) {
      prev.text += char;
    } else {
      runs.push({ tone, text: char });
    }
  }
  return runs;
};

export interface Run {
  text: string;
  tone: 0 | 1 | 2;
}

export const asciiOf = async (
  path: string,
  title: string,
  cols: number,
  rows = 7,
  focusY = 0.5
) => {
  const meta = await sharp(path).metadata();
  const width = meta.width ?? 1;
  const height = meta.height ?? 1;
  // Monospace cells are about 0.6 wide and 1.35 tall.
  const aspect = (cols * 0.6) / (rows * 1.35);
  let cw = width;
  let ch = Math.round(width / aspect);
  if (ch > height) {
    ch = height;
    cw = Math.round(height * aspect);
  }
  const left = Math.round((width - cw) / 2);
  const top = Math.min(
    height - ch,
    Math.max(0, Math.round(focusY * height - ch / 2))
  );
  const { data, info } = await sharp(path)
    .extract({ left, top, width: cw, height: ch })
    .resize(cols, rows, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const values: number[] = [];
  for (let k = 0; k < cols * rows; k++) {
    values.push(data[k * info.channels]);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.floor(sorted.length * 0.985)];
  const word = title.toLowerCase().replace(NOT_LETTER, "");

  const lines: Run[][] = [];
  for (let r = 0; r < rows; r++) {
    const levels = values.slice(r * cols, (r + 1) * cols).map((d) => {
      const v =
        Math.min(1, Math.max(0, (d - lo) / Math.max(1, hi - lo))) ** 0.7;
      return Math.min(8, Math.floor(v * 9));
    });
    lines.push(rowOf(levels, word, r));
  }
  return lines;
};
