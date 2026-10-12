import { describe, it, expect } from 'vitest';
import { getData, getGroup, getFund, twinsSortedByTer, originalsOf, validateData } from '../../src/lib/pairs';
import type { EtfData } from '../../src/lib/types';

const SOURCED = ['name', 'isin', 'ter', 'exchange', 'domicile', 'distribution', 'replication', 'index'] as const;
const clone = (): EtfData => structuredClone(getData());

describe('etf-pairs.json', () => {
  it('passes validateData', () => {
    expect(validateData(getData())).toEqual([]);
  });
  it('every Sourced field has https sourceUrl and ISO asOf', () => {
    for (const f of Object.values(getData().funds))
      for (const k of SOURCED) {
        expect(f[k].sourceUrl, `${f.id}.${k}`).toMatch(/^https:\/\/\S+$/);
        expect(f[k].asOf, `${f.id}.${k}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
  });
  it('contains no synthetic fund and no QQQ', () => {
    const funds = Object.values(getData().funds);
    expect(funds.filter((f) => f.replication.value === 'synthetic')).toEqual([]);
    expect(Object.keys(getData().funds)).not.toContain('QQQ');
  });
  it('defines the four groups in order with spec flags', () => {
    expect(getData().groups.map((g) => [g.id, g.exactTwin, g.calcEnabled])).toEqual([
      ['sp500', true, true], ['world', false, true], ['us-total', false, false], ['us-dividend', false, false],
    ]);
  });
  it('sorts S&P 500 twins by TER, ties alphabetically', () => {
    expect(twinsSortedByTer('sp500').map((f) => f.id)).toEqual(['SPYL', 'CSPX', 'VUAA']);
  });
  it('returns S&P 500 originals in defined order', () => {
    expect(originalsOf('sp500').map((f) => f.id)).toEqual(['VOO', 'SPY', 'IVV']);
    expect(getFund('SPY').ter.value).toBe(0.0945);
  });
  it('throws on unknown ids', () => {
    expect(() => getFund('QQQ')).toThrow('Unknown fund: QQQ');
    expect(() => getGroup('nope' as never)).toThrow('Unknown group: nope');
  });
});

describe('validateData', () => {
  it('reports non-https sourceUrl', () => {
    const d = clone(); d.funds.SPYL.ter.sourceUrl = 'http://x.test';
    expect(validateData(d)).toContain('funds.SPYL.ter.sourceUrl: must be https');
  });
  it('reports non-ISO asOf', () => {
    const d = clone(); d.funds.SPYL.isin.asOf = '11. 10. 2026';
    expect(validateData(d)).toContain('funds.SPYL.isin.asOf: must be YYYY-MM-DD');
  });
  it('reports aggregator sourceUrl host', () => {
    const d = clone(); d.funds.SPYL.ter.sourceUrl = 'https://www.justetf.com/en/etf-profile.html?isin=IE000XZSV718';
    expect(validateData(d)).toContain('funds.SPYL.ter: sourceUrl host not allowed: www.justetf.com');
  });
  it('rejects lookalike hosts of allowed domains', () => {
    const d = clone(); d.funds.SPYL.ter.sourceUrl = 'https://notssga.com/x';
    expect(validateData(d)).toContain('funds.SPYL.ter: sourceUrl host not allowed: notssga.com');
  });
  it('reports invalid ISIN check digit', () => {
    const d = clone(); d.funds.SPYL.isin.value = 'IE000XZSV719';
    expect(validateData(d)).toContain('funds.SPYL.isin: invalid ISIN');
  });
  it('reports missing group reference', () => {
    const d = clone(); d.groups[0].twins.push('XXXX');
    expect(validateData(d)).toContain('groups.sp500.twins: unknown fund XXXX');
  });
  it('reports synthetic twin', () => {
    const d = clone(); d.funds.VUAA.replication.value = 'synthetic';
    expect(validateData(d)).toContain('funds.VUAA.replication: synthetic funds are not allowed');
  });
  it('reports QQQ', () => {
    const d = clone(); d.funds.QQQ = { ...structuredClone(d.funds.VOO), id: 'QQQ' };
    expect(validateData(d)).toContain('funds.QQQ: QQQ is excluded');
  });
  it('reports kind mismatch in group', () => {
    const d = clone(); d.groups[0].originals.push('SPYL');
    expect(validateData(d)).toContain('groups.sp500.originals: SPYL must be kind us');
  });
});
