import { describe, it, expect } from 'vitest';
import { getData } from '../../src/lib/pairs';
import { publisherOf, publishersInData, fundSources } from '../../src/lib/sources';
import type { EtfData } from '../../src/lib/types';

describe('publisherOf', () => {
  it('maps issuer hosts (incl. country sites) to a publisher name', () => {
    expect(publisherOf('https://fund-docs.vanguard.com/F0968.pdf')).toBe('Vanguard');
    expect(publisherOf('https://www.de.vanguard/professionell/x')).toBe('Vanguard');
    expect(publisherOf('https://www.ssga.com/uk/x')).toBe('State Street Global Advisors');
    expect(publisherOf('https://www.ishares.com/us/x')).toBe('iShares');
    expect(publisherOf('https://www.schwabassetmanagement.com/products/schd')).toBe('Charles Schwab');
    expect(publisherOf('https://www.fidelityinternational.com/x.pdf')).toBe('Fidelity');
  });
  it('returns null for non-issuer hosts', () => {
    expect(publisherOf('https://www.sec.gov/Archives/x')).toBeNull();
    expect(publisherOf('https://evil-vanguard.example/x')).toBeNull();
  });
});

describe('sources from etf-pairs.json', () => {
  it('every source host is either a known issuer or SEC EDGAR', () => {
    for (const f of fundSources(getData()))
      for (const s of f.sources)
        expect(publisherOf(s.url) !== null || new URL(s.url).hostname === 'www.sec.gov', s.url).toBe(true);
  });
  it('lists publishers in data order, without duplicates', () => {
    expect(publishersInData(getData())).toEqual(['Vanguard', 'State Street Global Advisors', 'iShares', 'Charles Schwab', 'Fidelity']);
  });
  it('dedupes URLs per fund and keeps their asOf', () => {
    const voo = fundSources(getData()).find((f) => f.fundId === 'VOO')!;
    expect(voo.sources).toEqual([
      { url: 'https://fund-docs.vanguard.com/F0968.pdf', host: 'fund-docs.vanguard.com', asOf: getData().funds.VOO.ter.asOf },
      { url: 'https://www.sec.gov/Archives/edgar/data/36405/000168386321002763/f8950d1.htm', host: 'sec.gov', asOf: getData().funds.VOO.domicile.asOf },
    ]);
  });
  it('covers every fund, in data order', () => {
    expect(fundSources(getData()).map((f) => f.fundId)).toEqual(Object.keys(getData().funds));
  });
  it('a URL used with two dates is listed once per date', () => {
    const d: EtfData = structuredClone(getData());
    d.funds.VOO.isin.asOf = '2026-01-01';
    const voo = fundSources(d).find((f) => f.fundId === 'VOO')!;
    expect(voo.sources.filter((s) => s.url === 'https://fund-docs.vanguard.com/F0968.pdf').map((s) => s.asOf).sort())
      .toEqual(['2026-01-01', d.funds.VOO.ter.asOf].sort());
  });
});
