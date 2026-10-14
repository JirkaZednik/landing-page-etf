import { describe, it, expect } from 'vitest';
import { getData, getBrokers, getBroker, twinsAtBroker, twinsSortedByTer, validateBrokers, verifiedBrokers } from '../../src/lib/pairs';
import type { Broker, GroupId } from '../../src/lib/types';

const clone = (): Broker[] => structuredClone(getBrokers());

describe('brokers.json', () => {
  it('passes validateBrokers', () => {
    expect(validateBrokers(getBrokers(), getData())).toEqual([]);
  });
  it('lists the four brokers in order', () => {
    expect(getBrokers().map((b) => b.id)).toEqual(['xtb', 'trading212', 'fio', 'degiro']);
    expect(() => getBroker('revolut' as never)).toThrow('Unknown broker: revolut');
  });
  it('verifiedBrokers keeps only brokers with at least one verified fund, in order', () => {
    expect(verifiedBrokers().map((b) => b.id)).toEqual(['xtb', 'trading212', 'degiro']);
    expect(verifiedBrokers().map((b) => b.name).join(', ')).toBe('XTB, Trading 212, Degiro');
  });
  it('twinsAtBroker keeps TER order and only available listings', () => {
    const groups: GroupId[] = ['sp500', 'world', 'us-total', 'us-dividend'];
    for (const g of groups) {
      for (const b of getBrokers()) {
        const order = twinsSortedByTer(g).map((f) => f.id);
        const got = twinsAtBroker(b.id, g);
        const ids = got.map((x) => x.fund.id);
        expect(ids).toEqual(order.filter((id) => ids.includes(id)));
        for (const x of got) {
          const l = b.listings.find((l) => l.fundId === x.fund.id)!;
          expect(l.available.value).toBe(true);
          expect(x.ticker).toBe(l.ticker.value);
        }
      }
    }
  });
});

describe('validateBrokers', () => {
  it('reports unknown fundId', () => {
    const b = clone(); b[0].listings.push({ ...structuredClone(b[0].listings[0]), fundId: 'VOO' });
    expect(validateBrokers(b, getData())).toContain('brokers.xtb.listings.VOO: not a UCITS twin');
    const c = clone(); c[0].listings.push({ ...structuredClone(c[0].listings[0]), fundId: 'XXXX' });
    expect(validateBrokers(c, getData())).toContain('brokers.xtb.listings.XXXX: unknown fund');
  });
  it('reports duplicate listings', () => {
    const b = clone(); b[0].listings.push(structuredClone(b[0].listings[0]));
    expect(validateBrokers(b, getData())).toContain(`brokers.xtb.listings.${b[0].listings[0].fundId}: duplicate`);
  });
  it('reports non-https sources', () => {
    const b = clone(); b[1].buyFee.sourceUrl = 'http://x.test';
    expect(validateBrokers(b, getData())).toContain('brokers.trading212.buyFee.sourceUrl: must be https');
  });
  it('reports sources outside broker hosts', () => {
    const b = clone(); b[1].steps.sourceUrl = 'https://evil.example.com/x';
    expect(validateBrokers(b, getData())).toContain('brokers.trading212.steps: sourceUrl host not allowed: evil.example.com');
    const c = clone(); c[0].listings[0].ticker.sourceUrl = 'https://notxtb.com/x';
    expect(validateBrokers(c, getData())).toContain(`brokers.xtb.listings.${c[0].listings[0].fundId}.ticker: sourceUrl host not allowed: notxtb.com`);
  });
  it('reports bad dates, tickers and order', () => {
    const b = clone(); b[0].asOf = '2026-13-40'; b[0].listings[0].ticker.value = 'bad ticker';
    const errs = validateBrokers(b, getData());
    expect(errs).toContain('brokers.xtb.asOf: must be YYYY-MM-DD');
    expect(errs).toContain(`brokers.xtb.listings.${b[0].listings[0].fundId}.ticker: invalid`);
    expect(validateBrokers(clone().reverse(), getData())).toContain('brokers: expected xtb,trading212,fio,degiro');
  });
  it('reports empty steps', () => {
    const b = clone(); b[2].steps.value = [];
    expect(validateBrokers(b, getData())).toContain('brokers.fio.steps: empty');
  });
});
