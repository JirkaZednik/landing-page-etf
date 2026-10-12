import { describe, it, expect } from 'vitest';
import { formatCzk, formatTer, formatDateCz } from '../../src/lib/format';

const NB = ' ';

describe('formatCzk', () => {
  it.each([
    [6870, `6${NB}900${NB}Kč`],
    [20507, `20${NB}500${NB}Kč`],
    [230837, `230${NB}800${NB}Kč`],
    [1517433, `1${NB}517${NB}400${NB}Kč`],
    [720000, `720${NB}000${NB}Kč`],
    [950, `1${NB}000${NB}Kč`],
    [50, `100${NB}Kč`],
    [49, `0${NB}Kč`],
    [-0.4, `0${NB}Kč`],
  ])('formatCzk(%d)', (n, s) => expect(formatCzk(n)).toBe(s));

  it('uses no plain or narrow spaces', () => expect(formatCzk(1517433)).not.toMatch(/[  ]/));
});

describe('formatTer', () => {
  it.each([
    [0.0945, `0,09${NB}%`],
    [0.03, `0,03${NB}%`],
    [0.07, `0,07${NB}%`],
    [0.12, `0,12${NB}%`],
    [1.5, `1,50${NB}%`],
  ])('formatTer(%d)', (p, s) => expect(formatTer(p)).toBe(s));
});

describe('formatDateCz', () => {
  it.each([
    ['2026-10-11', '11. 10. 2026'],
    ['2026-01-05', '5. 1. 2026'],
  ])('formatDateCz(%s)', (iso, s) => expect(formatDateCz(iso)).toBe(s));
});
