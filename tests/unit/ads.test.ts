// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { imageSizeFromFile } from 'image-size/fromFile';
import { getFund } from '../../src/lib/pairs';
import { heroVariantFromUtm } from '../../src/lib/copy';

const SIZES = { '4x5': [1080, 1350], '9x16': [1080, 1920] } as const;

describe('ads', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'ads'], { stdio: 'inherit' });
  }, 180_000);

  for (const v of ['a', 'b'] as const)
    for (const [ratio, [w, h]] of Object.entries(SIZES))
      it(`ads/${v}-${ratio}.png is ${w}x${h}`, async () => {
        const d = await imageSizeFromFile(`ads/${v}-${ratio}.png`);
        expect([d.width, d.height]).toEqual([w, h]);
      });

  it('public/og.png is 1200x630 (Base.astro default og:image)', async () => {
    const d = await imageSizeFromFile('public/og.png');
    expect([d.width, d.height]).toEqual([1200, 630]);
  });

  it('template B takes SPYL ISIN and TER from data, not hardcoded', async () => {
    const raw = readFileSync('ads/templates/b.html', 'utf8');
    const spyl = getFund('SPYL');
    expect(raw).not.toContain(spyl.isin.value);
    expect(raw).toContain('{{SPYL.isin}}');
    expect(raw).not.toMatch(/\d,\d{2}\s?%/); // žádné TER natvrdo
    const { fillTemplate } = await import('../../scripts/render-ads');
    const filled = fillTemplate(raw);
    expect(filled).toContain(spyl.isin.value);
    expect(filled).not.toContain('{{');
  });

  it('template A has no hardcoded TER or ISIN', () => {
    const raw = readFileSync('ads/templates/a.html', 'utf8');
    expect(raw).not.toMatch(/\d,\d{2}\s?%/);
    expect(raw).not.toMatch(/\b[A-Z]{2}[A-Z0-9]{9}\d\b/);
  });

  it('copy.md has exact texts from spec §9 and UTM matching hero variant', () => {
    const md = readFileSync('ads/copy.md', 'utf8');
    for (const s of [
      'Hledali jste u brokera VOO a nenašli ho? Není to chyba. Evropská pravidla brání brokerům prodávat americké ETF drobným investorům. Na stejný index S&P 500 ale existují evropské fondy. Podívejte se, které to jsou a co stojí.',
      'VOO u evropského brokera nekoupíte. Tady je náhrada.',
      'Více informací',
      'Máte účet u XTB, Trading 212, Fio nebo Degira a chcete investovat do S&P 500? Nemusíte hledat ve stovkách fondů. Pošleme vám přesný ISIN a postup pro vašeho brokera.',
      'S&P 500 u vašeho brokera: přesný ISIN a postup',
      'Získat návod',
    ]) expect(md).toContain(s);
    for (const m of md.matchAll(/utm_content=([a-z0-9-]+)/g))
      expect(heroVariantFromUtm(m[1])).toBe(m[1][0]);
  });
});
