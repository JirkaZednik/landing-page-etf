import { describe, it, expect } from 'vitest';
import { MODEL_RETURN, COMPARISON_TER, LIMITS, clampInputs, futureValue, computeFees } from '../../src/lib/calc';

const near = (actual: number, expected: number, tol: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

describe('constants', () => {
  it('match spec', () => {
    expect(MODEL_RETURN).toBe(0.07);
    expect(COMPARISON_TER).toBe(1.5);
    expect(LIMITS).toEqual({ monthly: { min: 500, max: 50000, default: 3000 }, years: { min: 5, max: 40, default: 20 } });
  });
});

describe('futureValue', () => {
  it('3000 Kč / 20 let / 7 % / TER 0,03', () => near(futureValue(3000, 20, 0.07, 0.03), 1517433, 5));
  it('TER 0 = gross', () => near(futureValue(3000, 20, 0.07, 0), 1522609, 5));
  it('TER difference 0,03 vs 0,07 ≈ 6 870', () =>
    near(futureValue(3000, 20, 0.07, 0.03) - futureValue(3000, 20, 0.07, 0.07), 6870, 5));
  it('TER difference 0,03 vs 0,15 ≈ 20 507', () =>
    near(futureValue(3000, 20, 0.07, 0.03) - futureValue(3000, 20, 0.07, 0.15), 20507, 5));
  it('TER difference 0,03 vs 1,5 ≈ 230 837', () =>
    near(futureValue(3000, 20, 0.07, 0.03) - futureValue(3000, 20, 0.07, 1.5), 230837, 10));
  it('zero net return returns plain sum, no division by zero', () =>
    expect(futureValue(1000, 10, 0.015, 1.5)).toBe(120000));
});

describe('clampInputs', () => {
  it.each([
    ['', 20, { monthly: 3000, years: 20 }],
    ['3 000', 20, { monthly: 3000, years: 20 }],
    ['3 000', '25', { monthly: 3000, years: 25 }],
    [0, 20, { monthly: 500, years: 20 }],
    [-100, 20, { monthly: 500, years: 20 }],
    [999999, 20, { monthly: 50000, years: 20 }],
    ['abc', 20, { monthly: 3000, years: 20 }],
    [3000, NaN, { monthly: 3000, years: 20 }],
    [3000, 2, { monthly: 3000, years: 5 }],
    [3000, '45', { monthly: 3000, years: 40 }],
    [2999.6, 19.6, { monthly: 3000, years: 20 }],
    [undefined, null, { monthly: 3000, years: 20 }],
  ])('clampInputs(%j, %j)', (m, y, expected) => expect(clampInputs(m, y)).toEqual(expected));
});

describe('computeFees', () => {
  const funds = [{ id: 'SPYL', ter: 0.03 }, { id: 'CSPX', ter: 0.07 }, { id: 'VUAA', ter: 0.07 }];
  const r = computeFees({ monthly: 3000, years: 20, funds });

  it('deposited = 720 000', () => expect(r.deposited).toBe(720000));
  it('gross = FV at TER 0', () => expect(r.gross).toBe(futureValue(3000, 20, MODEL_RETURN, 0)));
  it('keeps fund order and computes feesPaid = gross − fv', () => {
    expect(r.rows.map((x) => x.id)).toEqual(['SPYL', 'CSPX', 'VUAA']);
    for (const row of r.rows) {
      expect(row.fv).toBe(futureValue(3000, 20, MODEL_RETURN, row.ter));
      expect(row.feesPaid).toBe(r.gross - row.fv);
    }
    near(r.rows[0].feesPaid, 5176, 5);
  });
  it('SPYL vs VUAA fee difference ≈ 6 870', () => near(r.rows[2].feesPaid - r.rows[0].feesPaid, 6870, 5));
  it('comparison row uses COMPARISON_TER', () => {
    expect(r.comparison.ter).toBe(1.5);
    near(r.comparison.feesPaid, 236013, 10);
    near(r.rows[0].fv - r.comparison.fv, 230837, 10);
  });
  it('clamps invalid input instead of producing NaN', () => {
    const bad = computeFees({ monthly: NaN, years: -3, funds });
    expect(bad.deposited).toBe(3000 * 5 * 12);
    for (const n of [bad.gross, ...bad.rows.flatMap((x) => [x.fv, x.feesPaid]), bad.comparison.feesPaid]) {
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });
});
