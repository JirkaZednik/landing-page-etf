// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const OUT_DIRS = ['.vercel/output/static', 'dist/client', 'dist'];
const listHtml = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listHtml(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : []);

type Header = { key: string; value: string };
const headersFor = (source: string): Header[] => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  return cfg.headers.find((h: { source: string }) => h.source === source)?.headers ?? [];
};
const csp = () => headersFor('/(.*)').find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
const directive = (name: string) =>
  csp().split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) ?? '';

describe('vercel.json security headers', () => {
  let html: string[] = [];
  beforeAll(() => {
    // Vitest sets NODE_ENV=test, which would make Vite bundle React's development build.
    if (!process.env.SKIP_BUILD)
      execFileSync('npm', ['run', 'build'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
    const dir = OUT_DIRS.find((d) => existsSync(d));
    if (!dir) throw new Error('build output not found');
    html = listHtml(dir);
  }, 300_000);

  it('has required static headers', () => {
    const h = Object.fromEntries(headersFor('/(.*)').map((x) => [x.key, x.value]));
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Permissions-Policy']).toContain('camera=()');
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive('script-src')).toContain('https://eu-assets.i.posthog.com');
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
    expect(directive('connect-src')).toContain('https://eu.i.posthog.com');
  });

  it('hashes every inline script, and nothing else', () => {
    const needed = new Set<string>();
    for (const file of html) {
      const src = readFileSync(file, 'utf8');
      expect(src, `${file} has inline event handler`).not.toMatch(/<[^>]+\son[a-z]+=/i);
      for (const m of src.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (/type=["']?application\/(ld\+)?json/i.test(m[1])) continue;
        needed.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
      }
    }
    const present = new Set(directive('script-src').match(/'sha256-[^']+'/g) ?? []);
    const missing = [...needed].filter((x) => !present.has(x));
    const extra = [...present].filter((x) => !needed.has(x));
    expect(missing, `add to script-src: ${missing.join(' ')}`).toEqual([]);
    expect(extra, `remove from script-src: ${extra.join(' ')}`).toEqual([]);
  });
});
