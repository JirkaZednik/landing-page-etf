import type { HeroVariant } from './types';
import { OPERATOR } from './operator';

export const CONSENT_TEXT_VERSION = '2026-10-13';
export const FORM_COPY = {
  button: 'Pošlete mi návod',
  placeholder: 'vas@email.cz',
  micro: 'Pošleme vám návod a občas tipy k investování do ETF. Odhlásíte se jedním klikem. Provozovatel a zpracování údajů:',
  errorInvalid: 'Zkontrolujte prosím e-mail.',
  errorServer: 'Něco se nepovedlo, zkuste to prosím znovu.',
} as const;

/** Hero variant from `utm_content`: anything starting with "b" is B, everything else A.
 *  Mirrored by the inline head script in src/pages/index.astro – keep both in sync. */
export function heroVariantFromUtm(utmContent: string | null): HeroVariant {
  return utmContent?.startsWith('b') ? 'b' : 'a';
}

export const HERO_COPY: Record<HeroVariant, { h1: string; sub: string }> = {
  a: {
    h1: 'U evropského brokera VOO jako drobný investor nekoupíte. Jeho evropské dvojče ano.',
    sub: 'Níže vidíte, které fondy sledují stejný index a kolik stojí. Návod, jak je koupit u vašeho brokera, vám pošleme zdarma.',
  },
  b: {
    h1: 'S&P 500 u vašeho brokera: který fond vybrat a jak ho najít.',
    sub: 'Tři evropské fondy na S&P 500 a jejich poplatky vidíte hned. Postup pro XTB, Trading 212, Fio a Degiro vám pošleme e-mailem.',
  },
};

/** Trust row under the hero form (redesign 2026-10-13, exact texts). */
export const HERO_TRUST = [
  'Data přímo od vydavatelů',
  'Návod pro XTB, Trading 212, Fio a Degiro',
  'Bez registrace',
] as const;

/** Phone offer on /dekujeme. API code `rate_limited` maps to `errors.server` in PhoneOffer. */
export const PHONE_COPY = {
  heading: 'Chcete pomoct s prvním nákupem?',
  lead: 'Zavoláme vám a projdeme postup u vašeho brokera, bez doporučování konkrétních fondů.',
  who: `Volat vám bude ${OPERATOR.name}.`,
  label: 'Telefon',
  placeholder: '777 123 456',
  consentCall: `Souhlasím, aby mě ${OPERATOR.name} telefonicky kontaktoval kvůli pomoci s nákupem u mého brokera.`,
  consentPartners: 'Souhlasím s předáním svého e-mailu a telefonu partnerům uvedeným v zásadách zpracování osobních údajů (nepovinné).',
  button: 'Zavolejte mi',
  success: 'Děkujeme, číslo máme. Ozveme se vám.',
  errors: {
    invalid_phone: 'Zadejte české číslo, např. 777 123 456 nebo +420 777 123 456.',
    consent_required: 'Bez souhlasu s telefonickým kontaktem vám zavolat nemůžeme.',
    phone_taken: `Toto číslo už u nás má jiný kontakt. Napište nám na ${OPERATOR.email}.`,
    server: 'Něco se nepovedlo, zkuste to znovu.',
  },
} as const;
