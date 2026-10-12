// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { getBrokers, getData, getFund } from '../../src/lib/pairs';
import { formatDateCz } from '../../src/lib/format';
import { sectionFor } from '../unit/helpers/pdf-text';

const PDF = 'public/navod-etf.pdf';
let text = '';

describe('build-pdf', () => {
  beforeAll(async () => {
    execFileSync('npx', ['tsx', 'scripts/build-pdf.tsx'], { stdio: 'inherit' });
    const parser = new PDFParse({ data: readFileSync(PDF) });
    text = (await parser.getText()).text;
    await parser.destroy();
  }, 120_000);

  it('writes a PDF smaller than 1 MB', () => {
    expect(existsSync(PDF)).toBe(true);
    expect(readFileSync(PDF).subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(statSync(PDF).size).toBeLessThan(1024 * 1024);
  });

  it('contains SPYL with its ISIN from data', () => {
    expect(text).toContain('SPYL');
    expect(text).toContain('IE000XZSV718');
    expect(getFund('SPYL').isin.value).toBe('IE000XZSV718');
  });

  it('has a section for every broker', () => {
    for (const b of getBrokers()) expect(text).toContain(`Návod pro ${b.name}`);
  });

  it('keeps Czech diacritics', () => {
    expect(text).toContain('Ověřeno k');
    expect(text).toContain('Všechny páry');
    expect(text).toContain('Akumulace, distribuce a daně v ČR');
    expect(text).toContain('Ověřeno k ' + formatDateCz(getData().asOf));
  });

  it('has the operator footer', () => {
    expect(text).toMatch(/IČO\s*\d{8}/);
  });

  it('omits funds a broker does not offer (real data)', () => {
    for (const b of getBrokers()) {
      const section = sectionFor(text, b.name);
      for (const l of b.listings.filter((x) => x.available.value === false)) {
        expect(section, `${b.name} / ${l.fundId}`).not.toContain(getFund(l.fundId).isin.value);
      }
    }
  });

  it('is honest about brokers without verified listings and lists verified ones', () => {
    for (const b of getBrokers()) {
      const section = sectionFor(text, b.name).replace(/\s+/g, ' ');
      if (b.listings.length === 0) {
        expect(section).toContain('U tohoto brokera jsme dostupnost zatím neověřili.');
      } else {
        expect(section).not.toContain('U tohoto brokera jsme dostupnost zatím neověřili.');
        for (const l of b.listings.filter((x) => x.available.value)) {
          expect(section).toContain(l.ticker.value);
          expect(section).toContain(getFund(l.fundId).isin.value);
        }
      }
      for (const step of b.steps.value) expect(section).toContain(step);
      expect(section).toContain(b.buyFee.value.slice(0, 30));
    }
  });
});
