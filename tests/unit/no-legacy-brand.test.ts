// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFParse } from 'pdf-parse';

// Legacy brand / operator strings must not survive anywhere in shipped code, ads or tests (spec v3).
// docs/ (history) and README (assignment context) are intentionally not scanned.
const FORBIDDEN = ['clientelo', 'indexák', 'indexak', '22193456', 'platnéřská'];
const ROOTS = ['src', 'ads', 'scripts', 'tests'];
const SELF = 'tests/unit/no-legacy-brand.test.ts';
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.woff', '.woff2', '.ico']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

function hits(text: string): string[] {
  const t = text.toLowerCase();
  return FORBIDDEN.filter((s) => t.includes(s));
}

describe('no legacy brand', () => {
  it('source, ads, scripts and tests contain no legacy brand or operator strings', () => {
    const found: string[] = [];
    for (const root of ROOTS) {
      for (const f of files(root)) {
        const rel = relative('.', f).split('\\').join('/');
        if (rel === SELF || BINARY.has(extname(f).toLowerCase())) continue;
        for (const h of hits(readFileSync(f, 'utf8'))) found.push(`${rel}: ${h}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('README mentions the client only as assignment / launch context, never the legacy brand or operator data', () => {
    const md = readFileSync('README.md', 'utf8');
    for (const t of [/indexák/i, /indexak/i, /22193456/, /platnéřská/i, /fundraising@clientelo\.cz/i, /Clientelo Czech s\.r\.o\./i, /725 345 102/])
      expect(md).not.toMatch(t);
  });

  it('the generated guide PDF carries the new brand only', async () => {
    const pdf = 'public/navod-etf.pdf';
    expect(existsSync(pdf)).toBe(true);
    const parser = new PDFParse({ data: readFileSync(pdf) });
    const text = (await parser.getText()).text;
    await parser.destroy();
    expect(hits(text)).toEqual([]);
    expect(text.replace(/\s+/g, ' ')).toContain('ETF Dvojče');
  });
});
