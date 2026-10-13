import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import {
  getData,
  getFund,
  twinsSortedByTer,
  originalsOf,
  getBrokers,
  validateData,
  validateBrokers,
} from '../src/lib/pairs';
import { formatTer, formatDateCz } from '../src/lib/format';
import { paletteCss } from '../src/styles/palette';
import { CURVE_ORIG, CURVE_TWIN, LABEL_BASELINE, PILL_HEIGHT, STARS, STAR_R, TWINS_VIEWBOX, twinsPills } from '../src/lib/twins-art';

const ROOT = new URL('../', import.meta.url);
const TPL = new URL('ads/templates/', ROOT);

type Size = { width: number; height: number; out: string };
/** Meta feed 4:5 and Stories/Reels 9:16 for both variants; OG image (1200×630) from variant A only. */
const RENDERS: Record<'a' | 'b', Record<string, Size>> = {
  a: {
    '4x5': { width: 1080, height: 1350, out: 'ads/a-4x5.png' },
    '9x16': { width: 1080, height: 1920, out: 'ads/a-9x16.png' },
    og: { width: 1200, height: 630, out: 'public/og.png' },
  },
  b: {
    '4x5': { width: 1080, height: 1350, out: 'ads/b-4x5.png' },
    '9x16': { width: 1080, height: 1920, out: 'ads/b-9x16.png' },
  },
};

const FONT_FACES = ['800 40px "Bricolage Grotesque"', '600 40px "Bricolage Grotesque"', '400 40px Figtree', '700 40px Figtree'];

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function tokensStyle(): string {
  return `<style>${paletteCss()}</style>`;
}

/** The hero illustration (same geometry as TwinsIllustration.astro), labels from data. */
function twinsSvg(): string {
  const { orig, twin } = twinsPills('sp500');
  const pill = (p: typeof orig, cls: string) =>
    `<g transform="translate(${p.x} ${p.y})"><rect class="twins__pill--${cls}" width="${p.width}" height="${PILL_HEIGHT}" rx="${PILL_HEIGHT / 2}"/>` +
    `<text class="twins__label twins__label--${cls}" x="${p.width / 2}" y="${LABEL_BASELINE}" text-anchor="middle">${esc(p.label)}</text></g>`;
  return (
    `<svg class="twins" viewBox="0 0 ${TWINS_VIEWBOX.width} ${TWINS_VIEWBOX.height}" aria-hidden="true">` +
    `<path class="twins__curve twins__curve--orig" d="${CURVE_ORIG}"/>` +
    `<path class="twins__curve twins__curve--twin" d="${CURVE_TWIN}"/>` +
    pill(orig, 'orig') +
    pill(twin, 'twin') +
    `<g class="twins__stars">${STARS.map((d) => `<circle cx="${d.cx}" cy="${d.cy}" r="${STAR_R}"/>`).join('')}</g>` +
    `</svg>`
  );
}

/** Meta button text of a variant, verbatim from ads/copy.md ("- Tlačítko: …"). */
function ctaFromCopy(v: 'a' | 'b'): string {
  const md = readFileSync(new URL('ads/copy.md', ROOT), 'utf8');
  const sec = md.split(`## Verze ${v.toUpperCase()}`)[1]?.split('\n## ')[0] ?? '';
  const m = sec.match(/^- Tlačítko: (.+)$/m);
  if (!m) throw new Error(`render-ads: no "Tlačítko" for variant ${v} in ads/copy.md`);
  return esc(m[1].trim());
}

/** Interní: nahradí placeholdery daty z etf-pairs.json / brokers.json. */
export function fillTemplate(html: string): string {
  const out = html.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    if (key === 'tokens') return tokensStyle();
    if (key === 'twins') return twinsSvg();
    if (key === 'cta.a' || key === 'cta.b') return ctaFromCopy(key.slice(4) as 'a' | 'b');
    if (key === 'asOf') return formatDateCz(getData().asOf);
    if (key === 'brokers') return esc(getBrokers().map((b) => b.name).join(' · '));
    if (key === 'sp500.twins') return esc(twinsSortedByTer('sp500').map((f) => f.id).join(' · '));
    if (key === 'sp500.originals') return esc(originalsOf('sp500').map((f) => f.id).join(' · '));
    // Řádky „ticker – TER" seřazené podle TER, jako tabulka v hero na webu.
    if (key === 'sp500.rows')
      return twinsSortedByTer('sp500')
        .map((f) => `<li><span class="ticker">${esc(f.id)}</span><span class="ter">${esc(formatTer(f.ter.value))}</span></li>`)
        .join('');
    const m = key.match(/^([A-Z0-9]+)\.(ter|isin|source)$/);
    if (m) {
      const f = getFund(m[1]); // vyhodí u neznámého fondu
      if (m[2] === 'ter') return esc(formatTer(f.ter.value));
      if (m[2] === 'isin') return esc(f.isin.value);
      return esc(new URL(f.ter.sourceUrl).hostname.replace(/^www\./, ''));
    }
    throw new Error(`Unknown placeholder {{${key}}}`);
  });
  if (out.includes('{{')) throw new Error('Unresolved placeholder');
  return out;
}

async function main() {
  const errors = [...validateData(getData()), ...validateBrokers(getBrokers(), getData())];
  if (errors.length) {
    console.error('render-ads: data validation failed:\n' + errors.join('\n'));
    process.exit(1); // neověřená data na kreativy nepustíme
  }
  const browser = await chromium.launch();
  try {
    for (const [v, sizes] of Object.entries(RENDERS)) {
      const filledPath = fileURLToPath(new URL(`_${v}.filled.html`, TPL));
      writeFileSync(filledPath, fillTemplate(readFileSync(new URL(`${v}.html`, TPL), 'utf8')));
      try {
        for (const [size, { width, height, out }] of Object.entries(sizes)) {
          const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
          await page.goto(`${pathToFileURL(filledPath).href}?size=${size}`);
          // Every face must really load (document.fonts.check() is true for undeclared families).
          const missing = await page.evaluate(async (specs) => {
            await document.fonts.ready;
            const faces = (await Promise.all(specs.map((sp) => document.fonts.load(sp)))).map((l) => l.length);
            return specs.filter((_, i) => faces[i] === 0);
          }, FONT_FACES);
          if (missing.length) throw new Error(`render-ads: fonts not loaded: ${missing.join(', ')}`);
          const outPath = fileURLToPath(new URL(out, ROOT));
          await page.screenshot({ path: outPath });
          await page.close();
          console.log(`render-ads: ${outPath}`);
        }
      } finally {
        rmSync(filledPath, { force: true });
      }
    }
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
