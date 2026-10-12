import type { HeroVariant } from './types';

export const CONSENT_TEXT_VERSION = '2026-10-11';
export const FORM_COPY = {
  button: 'Pošlete mi návod',
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
