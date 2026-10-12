import { describe, it, expect, vi } from 'vitest';

const src = { sourceUrl: 'https://example.com', asOf: '2026-10-11' };
vi.mock('../../src/data/brokers.json', () => ({
  default: [{
    id: 'xtb', name: 'XTB', asOf: '2026-10-11',
    buyFee: { value: '0 Kč', ...src }, steps: { value: ['Krok'], ...src },
    listings: [
      { fundId: 'VUAA', ticker: { value: 'VUAA', ...src }, available: { value: true, ...src } },
      { fundId: 'CSPX', ticker: { value: 'SXR8', ...src }, available: { value: true, ...src } },
      { fundId: 'SPYL', ticker: { value: 'SPYL', ...src }, available: { value: false, ...src } },
    ],
  }],
}));

describe('twinsAtBroker (fixture)', () => {
  it('drops unavailable, sorts by TER then id, returns broker ticker', async () => {
    const { twinsAtBroker } = await import('../../src/lib/pairs');
    expect(twinsAtBroker('xtb', 'sp500').map((x) => [x.fund.id, x.ticker])).toEqual([['CSPX', 'SXR8'], ['VUAA', 'VUAA']]);
  });
});
