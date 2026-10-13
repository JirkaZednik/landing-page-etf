import { describe, it, expect } from 'vitest';
import { heroVariantFromUtm, HERO_COPY, FORM_COPY, CONSENT_TEXT_VERSION, PHONE_COPY } from '../../src/lib/copy';
import { OPERATOR } from '../../src/lib/operator';

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
  it('PHONE_COPY texts', () => {
    expect(PHONE_COPY.heading).toBe('Chcete pomoct s prvním nákupem?');
    expect(PHONE_COPY.lead).toBe('Zavoláme vám a projdeme postup u vašeho brokera, bez doporučování konkrétních fondů.');
    expect(PHONE_COPY.who).toBe(`Volat vám bude ${OPERATOR.name}.`);
    expect(PHONE_COPY.label).toBe('Telefon');
    expect(PHONE_COPY.placeholder).toBe('777 123 456');
    expect(PHONE_COPY.consentCall).toBe(`Souhlasím, aby mě ${OPERATOR.name} telefonicky kontaktoval kvůli pomoci s nákupem u mého brokera.`);
    expect(PHONE_COPY.consentPartners).toBe('Souhlasím s předáním svého e-mailu a telefonu partnerům uvedeným v zásadách zpracování osobních údajů (nepovinné).');
    expect(PHONE_COPY.button).toBe('Zavolejte mi');
    expect(PHONE_COPY.success).toBe('Děkujeme, číslo máme. Ozveme se vám.');
    expect(PHONE_COPY).not.toHaveProperty('alreadyGiven');
    expect(PHONE_COPY.errors).toEqual({
      invalid_phone: 'Zadejte české číslo, např. 777 123 456 nebo +420 777 123 456.',
      consent_required: 'Bez souhlasu s telefonickým kontaktem vám zavolat nemůžeme.',
      phone_taken: `Toto číslo už u nás má jiný kontakt. Napište nám na ${OPERATOR.email}.`,
      server: 'Něco se nepovedlo, zkuste to znovu.',
    });
  });
});
