import { describe, it, expect } from 'vitest';
import { heroVariantFromUtm, HERO_COPY, FORM_COPY, CONSENT_TEXT_VERSION } from '../../src/lib/copy';

describe('copy', () => {
  it('heroVariantFromUtm', () => {
    expect(heroVariantFromUtm(null)).toBe('a');
    expect(heroVariantFromUtm('')).toBe('a');
    expect(heroVariantFromUtm('a')).toBe('a');
    expect(heroVariantFromUtm('b')).toBe('b');
    expect(heroVariantFromUtm('b_isin_9x16')).toBe('b');
    expect(heroVariantFromUtm('xb')).toBe('a');
  });
  it('HERO_COPY matches spec §9 exactly', () => {
    expect(HERO_COPY.a).toEqual({
      h1: 'U evropského brokera VOO jako drobný investor nekoupíte. Jeho evropské dvojče ano.',
      sub: 'Níže vidíte, které fondy sledují stejný index a kolik stojí. Návod, jak je koupit u vašeho brokera, vám pošleme zdarma.',
    });
    expect(HERO_COPY.b).toEqual({
      h1: 'S&P 500 u vašeho brokera: který fond vybrat a jak ho najít.',
      sub: 'Tři evropské fondy na S&P 500 a jejich poplatky vidíte hned. Postup pro XTB, Trading 212, Fio a Degiro vám pošleme e-mailem.',
    });
  });
  it('keeps Task 8 exports', () => {
    expect(FORM_COPY.button).toBe('Pošlete mi návod');
    expect(CONSENT_TEXT_VERSION).toBe('2026-10-11');
  });
});
