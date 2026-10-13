import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';

/** Build-time access (Node only: PDF and ad renderer) to the palette in src/styles/tokens.scss,
 *  the single source of truth for colours. Never import from client code (pulls in sass). */
export const PALETTE_KEYS = [
  'night', 'euro', 'euro-d', 'gold', 'mint', 'mint-text', 'mint-bg', 'cloud', 'ink', 'muted', 'white',
  'on-night-muted', 'line', 'alert', 'alert-bg',
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type Palette = Record<PaletteKey, string>;

const STYLES_DIR = fileURLToPath(new URL('./', import.meta.url));
let cache: Palette | undefined;

export function loadPalette(): Palette {
  if (cache) return cache;
  const css = compileString(
    `@use "tokens" as t; :root{${PALETTE_KEYS.map((k) => `--${k}:#{t.$${k}}`).join(';')}}`,
    { loadPaths: [STYLES_DIR] },
  ).css;
  const out = {} as Palette;
  for (const k of PALETTE_KEYS) {
    const m = css.match(new RegExp(`--${k}:\\s*(#[0-9a-fA-F]{6})\\b`));
    if (!m) throw new Error(`palette: token $${k} missing or not a 6-digit hex in tokens.scss`);
    out[k] = m[1].toUpperCase();
  }
  return (cache = out);
}

/** `:root{--night:#0F2257;…}` for HTML templates (ad creatives). */
export function paletteCss(): string {
  const p = loadPalette();
  return `:root{${PALETTE_KEYS.map((k) => `--${k}:${p[k]}`).join(';')}}`;
}

/** Multiply blend of two hex colours (the logo overlap, for renderers without mix-blend-mode). */
export function multiply(a: string, b: string): string {
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return '#' + x.map((v, i) => Math.round((v * y[i]) / 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
