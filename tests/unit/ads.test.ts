// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getBrokers, getFund, originalsOf, twinsSortedByTer } from '../../src/lib/pairs';
import { heroVariantFromUtm } from '../../src/lib/copy';
import { fillTemplate } from '../../scripts/render-ads';

// Pure template/copy checks; rendering to PNG is tested in tests/build/ads-render.test.ts.
const tpl = (v: 'a' | 'b') => readFileSync(`ads/templates/${v}.html`, 'utf8');

describe('ads templates', () => {
  it('template B takes SPYL ISIN and TER from data, not hardcoded', () => {
    const raw = tpl('b');
    const spyl = getFund('SPYL');
    expect(raw).not.toContain(spyl.isin.value);
    expect(raw).toContain('{{SPYL.isin}}');
    expect(raw).not.toMatch(/\d,\d{2}\s?%/); // žádné TER natvrdo
    const filled = fillTemplate(raw);
    expect(filled).toContain(spyl.isin.value);
    expect(filled).not.toContain('{{');
  });

  it('template B does not imply SPYL is available at every broker', () => {
    const filled = fillTemplate(tpl('b'));
    expect(filled).toContain(`Postup pro: ${getBrokers().map((b) => b.name).join(' · ')}`);
    expect(filled).toContain('Dostupnost fondů se u brokerů liší.');
  });

  it('both templates carry the ETF Dvojče brand', () => {
    for (const v of ['a', 'b'] as const) expect(tpl(v)).toContain('<p class="brand">ETF Dvojče</p>');
  });

  it('template A has no hardcoded TER or ISIN', () => {
    const raw = tpl('a');
    expect(raw).not.toMatch(/\d,\d{2}\s?%/);
    expect(raw).not.toMatch(/\b[A-Z]{2}[A-Z0-9]{9}\d\b/);
  });

  it('filled template A lists sp500 twins ordered by TER (SPYL, CSPX, VUAA)', () => {
    const filled = fillTemplate(tpl('a'));
    expect(filled).not.toContain('{{');
    const tickers = [...filled.matchAll(/<li><span class="ticker">([A-Z0-9]+)<\/span>/g)].map((m) => m[1]);
    expect(tickers).toEqual(['SPYL', 'CSPX', 'VUAA']);
    expect(tickers).toEqual(twinsSortedByTer('sp500').map((f) => f.id));
  });

  it('both templates use the hero look: logo, two-curve illustration labelled from data, gold CTA', () => {
    for (const v of ['a', 'b'] as const) {
      const raw = tpl(v);
      expect(raw).toContain('class="logo"');
      expect(raw).toContain('{{twins}}');
      expect(raw).toContain(`{{cta.${v}}}`);
      const filled = fillTemplate(raw);
      const svg = filled.match(/<svg class="twins"[\s\S]*?<\/svg>/)?.[0] ?? '';
      expect(svg).toContain(`>${originalsOf('sp500')[0].id}</text>`);
      expect(svg).toContain(`>${twinsSortedByTer('sp500')[0].id}</text>`);
      expect(svg.match(/<path /g)).toHaveLength(2);
    }
  });

  it('the CTA on each creative is the Meta button text from copy.md, unchanged', () => {
    const md = readFileSync('ads/copy.md', 'utf8');
    const button = (v: 'A' | 'B') => md.split(`## Verze ${v}`)[1].match(/^- Tlačítko: (.+)$/m)![1];
    expect(fillTemplate(tpl('a'))).toContain(`<p class="cta">${button('A')}</p>`);
    expect(fillTemplate(tpl('b'))).toContain(`<p class="cta">${button('B')}</p>`);
    expect(button('A')).toBe('Více informací');
    expect(button('B')).toBe('Získat návod');
  });

  it('on-image texts are unchanged by the redesign', () => {
    const a = fillTemplate(tpl('a'));
    expect(a).toContain('<p class="note">u evropského brokera nedostupné</p>');
    // nbsp only keeps „S&P 500“ on one line; the visible text is unchanged
    expect(a.replace(/&nbsp;/g, ' ')).toContain('<p class="claim">Stejný index S&amp;P 500. Evropský fond, který koupíte.</p>');
    expect(a).toMatch(/<p class="source">TER ročně\. Zdroj: vydavatelé fondů, k&nbsp;[^<]+\. Nejde o&nbsp;investiční doporučení\.<\/p>/);
    const b = fillTemplate(tpl('b'));
    expect(b).toContain('<p class="claim">Přesný ISIN a&nbsp;postup pro vašeho brokera.</p>');
    expect(b).toContain('<p class="search-label">Hledat</p>');
  });

  it('fillTemplate rejects unknown placeholders and funds', () => {
    expect(() => fillTemplate('{{nope}}')).toThrow(/Unknown placeholder/);
    expect(() => fillTemplate('{{FOO.ter}}')).toThrow(/Unknown fund/);
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
    const utms = [...md.matchAll(/utm_content=([a-z0-9-]+)/g)].map((m) => m[1]);
    expect(utms).toHaveLength(4);
    for (const u of utms) expect(heroVariantFromUtm(u)).toBe(u[0]);
  });
});
