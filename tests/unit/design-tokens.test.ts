import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// Redesign 2026-10-13 ("EU modrá a zlatá"): exact palette from the plan's Global Constraints,
// and WCAG 2.x contrast for every text/background pair the page uses.
const src = readFileSync(new URL('../../src/styles/tokens.scss', import.meta.url), 'utf8');

const tokens: Record<string, string> = {};
for (const m of src.matchAll(/^\$([a-z][\w-]*):\s*(#[0-9a-fA-F]{3,8})\s*;/gm)) tokens[m[1]] = m[2].toUpperCase();

const tok = (name: string): string => {
  const v = tokens[name];
  if (!v) throw new Error(`token $${name} missing in tokens.scss`);
  return v;
};

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('design tokens', () => {
  it('palette has the exact hex values from the plan', () => {
    expect({
      night: tok('night'), euro: tok('euro'), 'euro-d': tok('euro-d'), gold: tok('gold'),
      mint: tok('mint'), 'mint-text': tok('mint-text'), 'mint-bg': tok('mint-bg'),
      cloud: tok('cloud'), ink: tok('ink'), muted: tok('muted'), white: tok('white'),
    }).toEqual({
      night: '#0F2257', euro: '#2F5BFF', 'euro-d': '#1E44D8', gold: '#FFC93C',
      mint: '#33D6A6', 'mint-text': '#0B7A57', 'mint-bg': '#DDF8EE',
      cloud: '#F3F6FF', ink: '#141A33', muted: '#5A6385', white: '#FFFFFF',
    });
  });

  it('small text on night is at least #C9D3F5', () => {
    expect(tok('on-night-muted')).toBe('#C9D3F5');
  });

  it('old broadsheet tokens and fonts are gone', () => {
    expect(src).not.toMatch(/Newsreader|IBM Plex|\$paper|\$signal/);
    expect(src).toMatch(/\$font-display:\s*'Bricolage Grotesque'/);
    expect(src).toMatch(/\$font-text:\s*'Figtree Variable'/);
  });

  it('transitional aliases and mono fonts are gone from all styles', () => {
    const files = [
      '../../src/styles/tokens.scss', '../../src/styles/global.scss',
      ...readdirSync(new URL('../../src/components/', import.meta.url)).map((f) => `../../src/components/${f}`),
      ...readdirSync(new URL('../../src/pages/', import.meta.url)).filter((f) => f.endsWith('.astro')).map((f) => `../../src/pages/${f}`),
    ];
    for (const f of files) {
      const css = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(css, f).not.toMatch(/\$font-mono|--paper|--signal|--rule\b|monospace/);
    }
  });

  it('sanity: contrast() matches known WCAG values', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  // [foreground, background, minimum]
  const PAIRS: [string, string, number][] = [
    ['white', 'night', 7],
    ['on-night-muted', 'night', 4.5],
    ['night', 'gold', 7],
    ['euro-d', 'cloud', 4.5],
    ['ink', 'white', 7],
    ['muted', 'white', 4.5],
    ['mint-text', 'white', 4.5],
    // also used by the hero (answer-card badge, links, secondary button text)
    ['alert', 'alert-bg', 4.5],
    ['euro-d', 'white', 4.5],
    ['white', 'euro', 4.5],
    ['muted', 'cloud', 4.5],
    // Task 2: selected chip ticker (gold on night), body text and code chips on --cloud
    ['gold', 'night', 4.5],
    ['ink', 'cloud', 7],
  ];
  for (const [fg, bg, min] of PAIRS) {
    it(`${fg} on ${bg} ≥ ${min}:1`, () => {
      expect(contrast(tok(fg), tok(bg))).toBeGreaterThanOrEqual(min);
    });
  }
});
