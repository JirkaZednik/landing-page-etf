// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPARISON_TER, MODEL_RETURN } from '../../src/lib/calc';

const REQUIRED_HEADINGS = [
  '## Výklad zadání',
  '## Cílová skupina',
  '## Nabídka a moment žádosti o kontakt',
  '## Pořadí sekcí a proč',
  '## Cesta od každého prvku ke kontaktu',
  '## Klíčová rozhodnutí',
  '## Reklamy A/B',
  '## Očekávaná konverze',
  '## A/B hypotézy',
  '## Měření',
  '## Zdroje dat',
  '## Měsíční aktualizace dat',
  '## Checklist před spuštěním reklamy',
  '## Produkční nasazení',
  '## Lokální spuštění a testy',
];

describe('README', () => {
  const md = existsSync('README.md') ? readFileSync('README.md', 'utf8') : '';

  it('has all required headings in order', () => {
    let pos = -1;
    for (const h of REQUIRED_HEADINGS) {
      const i = md.indexOf(`\n${h}\n`);
      expect(i, `missing or out of order: ${h}`).toBeGreaterThan(pos);
      pos = i;
    }
  });

  it('starts with the interpretation of the brief', () => {
    expect(md.split('\n## ')[1]).toMatch(/^Výklad zadání\n+.*PRIIPs/s);
  });

  it('links existing ad PNGs and docs', () => {
    for (const f of ['ads/a-4x5.png', 'ads/a-9x16.png', 'ads/b-4x5.png', 'ads/b-9x16.png', 'ads/copy.md', 'docs/brevo-setup.md', 'docs/lighthouse-mobile.json']) {
      expect(md).toContain(`(${f})`);
      expect(existsSync(f), f).toBe(true);
    }
  });

  it('contains sample size result and formula', () => {
    expect(md).toContain('10 319');
    expect(md).toMatch(/α\s*=\s*0,05/);
    expect(md).toContain('(p₂ − p₁)²');
  });

  it('states numbers consistent with calc.ts', () => {
    const cz = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
    expect(md).toContain(`${cz(MODEL_RETURN * 100)} % p.a.`); // 0.07*100 = 7.000000000000001 → „7"
    expect(md).toContain(`${cz(COMPARISON_TER)} % p.a.`);     // „1,5"
  });

  it('marks conversion as an estimate and has launch status', () => {
    expect(md).toMatch(/odhad/i);
    expect(md).toContain('1 000 návštěv');
    expect(md).toMatch(/Stav: připraveno, blokuje:/);
  });

  it('does not mention funds that are not in the data', () => {
    for (const t of ['FWRA', 'ZPR3', 'CRSP US Total Market Index']) expect(md).not.toContain(t);
  });
});
