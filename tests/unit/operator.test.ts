import { describe, it, expect } from 'vitest';
import { OPERATOR } from '../../src/lib/operator';

describe('OPERATOR', () => {
  it('is the neutral demo operator', () => {
    expect(OPERATOR.name).toBe('ETF Dvojče – ukázkový projekt');
    expect(OPERATOR.email).toBe('etf-dvojce@seznam.cz');
    expect(OPERATOR.note).toBe('Ukázkový projekt vytvořený jako zadání pro přijímací řízení. Nejde o nabídku investičních služeb.');
  });
  it('has no company registration, address or phone', () => {
    for (const k of ['ico', 'address', 'phone']) expect(OPERATOR).not.toHaveProperty(k);
  });
});
