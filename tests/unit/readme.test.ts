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
  '## Vizuální styl',
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

  it('has a short "Vizuální styl" section with the palette, fonts and the mockup link', () => {
    const sec = md.slice(md.indexOf('\n## Vizuální styl\n'), md.indexOf('\n## Reklamy A/B\n'));
    const scss = readFileSync('src/styles/tokens.scss', 'utf8');
    for (const k of ['night', 'euro', 'euro-d', 'gold', 'mint', 'mint-text', 'mint-bg', 'cloud', 'ink', 'muted']) {
      const hex = scss.match(new RegExp(`^\\$${k}:\\s*(#[0-9A-Fa-f]{6})`, 'm'))![1];
      expect(sec, k).toContain(`\`--${k}\``);
      expect(sec, k).toContain(hex);
    }
    expect(sec).toContain('Bricolage Grotesque');
    expect(sec).toContain('Figtree');
    expect(sec).toContain('(docs/design/2026-10-13-redesign-mockup.html)');
    expect(existsSync('docs/design/2026-10-13-redesign-mockup.html')).toBe(true);
    expect(sec.split('\n').filter((l) => l.trim()).length).toBeLessThanOrEqual(20);
    expect(md).not.toMatch(/motiv `⇄`/);
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
    expect(md).toMatch(/^\*\*Demo: připraveno\.\*\*/m);
    expect(md).toMatch(/^\*\*Před ostrým spuštěním u klienta:\*\*/m);
  });

  it('uses the ETF Dvojče brand and the neutral demo operator; client only as context', () => {
    expect(md.split('\n')[0]).toMatch(/^# ETF Dvojče/);
    expect(md).toContain('ETF Dvojče – ukázkový projekt');
    expect(md).toContain('etf-dvojce@seznam.cz');
    // absence of the legacy brand/operator in README is checked in no-legacy-brand.test.ts
    const live = md.split('\n').find((l) => l.startsWith('**Před ostrým spuštěním u klienta:**'))!;
    expect(live).toContain('`src/lib/operator.ts`');
    expect(live).toMatch(/seznam(u)? partnerů/);
    expect(live).toMatch(/souhlas klienta/);
    expect(live).toMatch(/právník/);
  });

  it('does not mention funds that are not in the data', () => {
    for (const t of ['FWRA', 'ZPR3', 'CRSP US Total Market Index']) expect(md).not.toContain(t);
  });

  it('describes Trading 212 and Fio as not yet verified (broker table, prose and checklist)', () => {
    expect(md).toMatch(/^\| Trading 212 \| \*\*žádné zatím neověřené\*\*/m);
    expect(md).toMatch(/^\| Fio banka \| \*\*žádné zatím neověřené\*\*/m);
    expect(md).toContain('U tohoto brokera jsme dostupnost zatím neověřili.');
    expect(md).toMatch(/^- \[ \] .*\*\*Trading 212 a Fio zatím nemají žádný ověřený fond\*\*/m);
    expect(md).toMatch(/Před ostrým spuštěním u klienta:\*\*.*ověření (dat )?brokerů Trading 212 a Fio/);
    // never claimed as verified
    expect(md).not.toMatch(/Trading 212 (a Fio )?(jsou|je) ověřen/);
  });

  it('does not overclaim: nothing has been measured in production yet', () => {
    const answer = md.split('\n').find((l) => l.startsWith('**Mohli bychom zítra spustit reklamu?**'))!;
    expect(answer).not.toMatch(/měření a testy jsou hotové/);
    expect(answer).toMatch(/na produkci .*zatím nic neměřilo/);
  });

  it('measurement section matches the code: aid never in PostHog URLs, consent switches in place', () => {
    const sec = md.slice(md.indexOf('### Měření bez souhlasu a se souhlasem'), md.indexOf('## Reklamy A/B'));
    expect(sec).toContain('`$current_url`');
    expect(sec).toContain('`$referrer`');
    expect(sec).toContain('`before_send`');
    expect(sec).toMatch(/bez znovunačtení stránky/);
    expect(sec).toContain('`identify(aid)`');
  });

  it('paid tiers are only Vercel and Brevo; PostHog, Meta and Upstash are accounts to set up', () => {
    const status = md.split('\n').find((l) => l.startsWith('**Před ostrým spuštěním u klienta:**'))!;
    const paid = status.match(/placené tarify \(([^)]*)\)/)![1];
    expect(paid).toMatch(/Vercel/);
    expect(paid).toMatch(/Brevo/);
    for (const t of ['PostHog', 'Meta', 'Upstash']) expect(paid).not.toContain(t);
    expect(status).toMatch(/účty .*\(PostHog, Meta, Upstash\)/);
  });

  it('rounds the minimum detectable effect and words the H3 row precisely', () => {
    expect(md).not.toContain('6,85 %');
    expect(md).toContain('4 → ≈ 6,8 %');
  });

  it('single opt-in: DOI only in the one sentence explaining why it was not chosen', () => {
    const sentences = md.split(/(?<=[.!?])\s+|\n/).filter((x) => /double opt-in|\bDOI\b/i.test(x));
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toMatch(/^Single opt-in jsme zvolili místo double opt-in \(DOI\), protože/);
    expect(md).not.toContain('/potvrzeno');
    expect(md).not.toContain('doi_confirmed');
    expect(md).not.toContain('BREVO_DOI_TEMPLATE_ID');
    expect(md).toContain('| Lead → stažení PDF na `/dekujeme` | **60–80 %** (odhad) |');
  });

  it('H3 is the phone-offer position test with a computed sample size', () => {
    const ab = md.slice(md.indexOf('\n## A/B hypotézy\n'), md.indexOf('\n## Měření\n'));
    const h3 = ab.split('\n').find((l) => l.startsWith('| 3 |'))!;
    expect(h3).toMatch(/nabídka telefonu nad tlačítkem „Stáhnout návod \(PDF\)" vs\. pod ním/);
    expect(h3).toContain('míra telefonů z leadů');
    expect(h3).toContain('+40 % relativně (5 → 7 % leadů)');
    expect(h3).toContain('≈ 2 213 leadů ≈ 55 300 návštěv (při konverzi 4 %)');
    // same formula as H1/H2: z = 1,960 and 0,842, p₁ = 5 %, p₂ = 7 %
    expect(md).toContain('(1,960 · √(2 · 0,06 · 0,94) + 0,842 · √(0,05 · 0,95 + 0,07 · 0,93))² / 0,02²');
    expect(md).toContain('2 213 / 0,04 ≈ 55 300');
  });
});

