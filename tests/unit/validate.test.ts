// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isUuid, isValidEmail, normalizeCzPhone } from '../../src/lib/validate';

describe('isValidEmail', () => {
  it.each([
    ['jan.novak@seznam.cz', true],
    [' Jan.Novak@Email.CZ ', true],
    ['jana+etf@post.example.co.uk', true],
    ['', false],
    ['jan@seznam', false],
    ['jan@@seznam.cz', false],
    ['jan novak@seznam.cz', false],
    ['@seznam.cz', false],
    ['jan@seznam.c', false],
    [`${'a'.repeat(250)}@x.cz`, false],
  ])('%s → %s', (input, ok) => expect(isValidEmail(input)).toBe(ok));
});

describe('normalizeCzPhone', () => {
  it.each([
    ['777 123 456', '+420777123456'],
    ['+420777123456', '+420777123456'],
    ['00420 777 123 456', '+420777123456'],
    ['+420 777-123-456', '+420777123456'],
    ['420777123456', '+420777123456'],
    ['(+420) 601 234 567', '+420601234567'],
  ])('%s → %s', (input, out) => expect(normalizeCzPhone(input)).toBe(out));
  it.each(['+421 905 123 456', '12345', '', '777 123 4567', '+420 077 123 456', '+420 777 123 45a'])(
    '%s → null', (input) => expect(normalizeCzPhone(input)).toBeNull());
});

describe('isUuid', () => {
  it.each([
    ['11111111-1111-4111-8111-111111111111', true],
    ['AAAAAAAA-1111-4111-8111-111111111111', true],
    ['abc', false],
    ['', false],
    ['11111111-1111-4111-8111-11111111111g', false],
  ])('%s → %s', (input, ok) => expect(isUuid(input)).toBe(ok));
});
