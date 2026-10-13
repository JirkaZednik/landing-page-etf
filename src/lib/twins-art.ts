import { originalsOf, twinsSortedByTer } from './pairs';

/** Geometry of the brand art, shared by the hero (TwinsIllustration.astro), the ad creatives and the
 *  guide PDF so all three draw the same picture. Coordinates are in the 300×130 illustration viewBox
 *  and the 34×22 logo viewBox. Labels always come from data. */
export const TWINS_VIEWBOX = { width: 300, height: 130 } as const;
export const CURVE_ORIG = 'M18 108 C60 108 70 46 108 46 S150 84 176 70 230 26 282 22';
export const CURVE_TWIN = 'M18 118 C60 118 70 56 108 56 S150 94 176 80 230 36 282 32';
export const CURVE_WIDTH = 6;
export const PILL_HEIGHT = 34;
export const LABEL_SIZE = 17;
export const LABEL_BASELINE = 23;
export const STAR_R = 2.4;

export const pillWidth = (t: string) => Math.max(64, Math.round(t.length * 11.5 + 30));

/** Arc of five dots (the EU stars) above the top of the curves. */
export const STARS = [-2, -1, 0, 1, 2].map((i) => {
  const a = (i * 26 * Math.PI) / 180;
  return { cx: +(160 + 22 * Math.sin(a)).toFixed(1), cy: +(34 - 22 * Math.cos(a)).toFixed(1) };
});

export interface Pill { label: string; x: number; y: number; width: number }

/** Original (first NYSE fund) top-left, lowest-TER twin bottom-right, as in the hero. */
export function twinsPills(group: Parameters<typeof originalsOf>[0] = 'sp500'): { orig: Pill; twin: Pill } {
  const o = originalsOf(group)[0].id;
  const t = twinsSortedByTer(group)[0].id;
  const wO = pillWidth(o);
  const wT = pillWidth(t);
  return {
    orig: { label: o, x: 86 - wO / 2, y: 8, width: wO },
    twin: { label: t, x: 218 - wT / 2, y: 92, width: wT },
  };
}

/** Logo mark: two overlapping circles (EU blue left, gold right); LOGO_LENS is their overlap, so
 *  renderers without blend modes (PDF) can paint it in the multiplied colour. */
export const LOGO_VIEWBOX = { width: 34, height: 22 } as const;
export const LOGO_CIRCLES = { left: { cx: 11, cy: 11, r: 10 }, right: { cx: 23, cy: 11, r: 10 } } as const;
export const LOGO_LENS = 'M17 3 A10 10 0 0 1 17 19 A10 10 0 0 1 17 3 Z';
