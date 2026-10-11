import { describe, it, expect } from 'vitest';
import { OPERATOR } from '../../src/lib/operator';

describe('OPERATOR', () => {
  it('holds Clientelo footer data', () => {
    expect(OPERATOR).toEqual({
      name: 'Clientelo Czech s.r.o.',
      ico: '22193456',
      address: 'Platnéřská 90/13, Staré Město, 110 00 Praha 1',
      email: 'fundraising@clientelo.cz',
      phone: '+420 725 345 102',
      web: 'https://clientelo.cz',
    });
  });
  it('ICO has a valid Czech checksum', () => {
    const d = OPERATOR.ico.split('').map(Number);
    const sum = d.slice(0, 7).reduce((s, n, i) => s + n * (8 - i), 0);
    expect((11 - (sum % 11)) % 10).toBe(d[7]);
  });
});
