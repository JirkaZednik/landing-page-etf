const czk = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
const ter = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Normalise every kind of space (incl. narrow NBSP from some ICU builds) to a plain NBSP. */
const nbsp = (s: string) => s.replace(/[\s  ]/g, ' ');

export function formatCzk(n: number): string {
  const rounded = Math.round(n / 100) * 100 || 0;
  return nbsp(czk.format(rounded) + ' Kč');
}

export function formatTer(p: number): string {
  return nbsp(ter.format(p) + ' %');
}

/** ISO date (YYYY-MM-DD) to Czech `D. M. YYYY`. */
export function formatDateCz(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}
