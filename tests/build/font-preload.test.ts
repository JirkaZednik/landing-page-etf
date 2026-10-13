// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Final review Critical 1: the critical faces (Bricolage 800 latin + latin-ext for the H1/tickers,
// Figtree latin for the text) are preloaded with the same hashed URL the @font-face rules use.
const OUT_DIRS = ['.vercel/output/static', 'dist/client', 'dist'];
const CRITICAL = [
  /\/bricolage-grotesque-latin-800-normal\.[\w-]+\.woff2$/,
  /\/bricolage-grotesque-latin-ext-800-normal\.[\w-]+\.woff2$/,
  /\/figtree-latin-wght-normal\.[\w-]+\.woff2$/,
];

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}(?:=["']?([^"'\\s>]*)["']?)?(?=[\\s>/])`, 'i'));

describe('critical font preloads in the built HTML', () => {
  let dir = '';
  let pages: string[] = [];
  let styles = '';
  beforeAll(() => {
    // Vitest sets NODE_ENV=test, which would make Vite bundle React's development build.
    if (!process.env.SKIP_BUILD)
      execFileSync('npm', ['run', 'build'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
    dir = OUT_DIRS.find((d) => existsSync(d)) ?? '';
    if (!dir) throw new Error('build output not found');
    const files = walk(dir);
    pages = files.filter((f) => f.endsWith('.html'));
    // @font-face may live in external CSS or inline <style> (inlineStylesheets).
    styles = files.filter((f) => f.endsWith('.css') || f.endsWith('.html')).map((f) => readFileSync(f, 'utf8')).join('\n');
  }, 300_000);

  it('home page preloads exactly the three critical woff2 files, with crossorigin, before any stylesheet', () => {
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
    const preloads = links.filter((l) => attr(l, 'rel')?.[1] === 'preload' && attr(l, 'as')?.[1] === 'font');
    expect(preloads).toHaveLength(3);
    for (const l of preloads) {
      expect(attr(l, 'type')?.[1], l).toBe('font/woff2');
      expect(attr(l, 'crossorigin'), `${l} needs crossorigin (fonts are fetched in CORS mode)`).not.toBeNull();
    }
    const hrefs = preloads.map((l) => attr(l, 'href')![1]);
    for (const re of CRITICAL) expect(hrefs.filter((h) => re.test(h)), String(re)).toHaveLength(1);
    const firstStyle = html.search(/<link\b[^>]*rel=["']?stylesheet|<style\b/i);
    if (firstStyle >= 0) for (const l of preloads) expect(html.indexOf(l)).toBeLessThan(firstStyle);
  });

  it('every preloaded URL exists and is the one the @font-face rules use (no double download)', () => {
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const hrefs = [...html.matchAll(/<link\b[^>]*rel=["']?preload[^>]*>/gi)].map((m) => attr(m[0], 'href')![1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) {
      expect(existsSync(join(dir, h)), h).toBe(true);
      expect(styles, `${h} referenced from @font-face`).toMatch(new RegExp(`url\\(["']?${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\)`));
    }
  });

  it('every page with the base layout carries the preloads', () => {
    const withLayout = pages.filter((f) => readFileSync(f, 'utf8').includes('rel="icon"'));
    expect(withLayout.length).toBeGreaterThan(3);
    for (const f of withLayout)
      expect([...readFileSync(f, 'utf8').matchAll(/rel=["']?preload["']?[^>]*as=["']?font/gi)].length, f).toBe(3);
  });
});
