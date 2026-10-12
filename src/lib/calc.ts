export const MODEL_RETURN = 0.07;
export const COMPARISON_TER = 1.5;
export const LIMITS = {
  monthly: { min: 500, max: 50000, default: 3000 },
  years: { min: 5, max: 40, default: 20 },
} as const;

export type FeeResult = {
  deposited: number;
  gross: number;
  rows: { id: string; ter: number; fv: number; feesPaid: number }[];
  comparison: { ter: number; fv: number; feesPaid: number };
};

type Limit = { min: number; max: number; default: number };

function clampOne(value: unknown, limit: Limit): number {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    const cleaned = value.replace(/[\s  ]/g, '').replace(',', '.');
    n = cleaned === '' ? NaN : Number(cleaned);
  } else {
    return limit.default;
  }
  if (!Number.isFinite(n)) return limit.default;
  return Math.min(limit.max, Math.max(limit.min, Math.round(n)));
}

export function clampInputs(monthly: unknown, years: unknown): { monthly: number; years: number } {
  return {
    monthly: clampOne(monthly, LIMITS.monthly),
    years: clampOne(years, LIMITS.years),
  };
}

/** Future value of monthly deposits (end of month) after fee `terPercent` is deducted from the annual return. */
export function futureValue(monthly: number, years: number, annualReturn: number, terPercent: number): number {
  const net = annualReturn - terPercent / 100;
  const r = Math.pow(1 + net, 1 / 12) - 1;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return (monthly * (Math.pow(1 + r, n) - 1)) / r;
}

export function computeFees(input: {
  monthly: number;
  years: number;
  funds: { id: string; ter: number }[];
  annualReturn?: number;
}): FeeResult {
  const { monthly, years } = clampInputs(input.monthly, input.years);
  const annualReturn = input.annualReturn ?? MODEL_RETURN;
  const gross = futureValue(monthly, years, annualReturn, 0);
  const rows = input.funds.map((f) => {
    const fv = futureValue(monthly, years, annualReturn, f.ter);
    return { id: f.id, ter: f.ter, fv, feesPaid: gross - fv };
  });
  const comparisonFv = futureValue(monthly, years, annualReturn, COMPARISON_TER);
  return {
    deposited: monthly * years * 12,
    gross,
    rows,
    comparison: { ter: COMPARISON_TER, fv: comparisonFv, feesPaid: gross - comparisonFv },
  };
}
