// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE_KEYS, loadPalette, paletteCss } from '../../src/styles/palette';

// The PDF and the ad creatives read colours from src/styles/tokens.scss through one module.
const scss = readFileSync('src/styles/tokens.scss', 'utf8');
const fromScss = (k: string) => scss.match(new RegExp(`^\\$${k}:\\s*(#[0-9A-Fa-f]{6})`, 'm'))?.[1].toUpperCase();

describe('palette', () => {
  it('loadPalette returns the exact tokens.scss hex values', () => {
    const p = loadPalette();
    expect(Object.keys(p).sort()).toEqual([...PALETTE_KEYS].sort());
    for (const k of PALETTE_KEYS) expect(p[k], k).toBe(fromScss(k));
    expect(p.night).toBe('#0F2257');
    expect(p.gold).toBe('#FFC93C');
  });

  it('paletteCss exposes every token as a CSS custom property', () => {
    const css = paletteCss();
    for (const k of PALETTE_KEYS) expect(css).toContain(`--${k}:${fromScss(k)}`);
  });

  it('PDF and ad renderer use the shared palette, no hex literals or old token names', () => {
    for (const f of ['src/pdf/GuideDocument.tsx', 'scripts/render-ads.ts', 'ads/templates/ads.css']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
      expect(src, f).not.toMatch(/--paper|--signal|--rule\b|IxText|IxMono|monospace/);
    }
  });
});
