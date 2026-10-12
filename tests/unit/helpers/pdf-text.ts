/** Text sekce „Návod pro {broker}" až po další sekci brokera nebo tabulku všech párů. */
export function sectionFor(all: string, brokerName: string): string {
  const start = all.indexOf(`Návod pro ${brokerName}`);
  if (start < 0) throw new Error(`section ${brokerName} missing`);
  const rest = all.slice(start + 1);
  const ends = [rest.indexOf('Návod pro '), rest.indexOf('Všechny páry')].filter((i) => i >= 0);
  return all.slice(start, start + 1 + Math.min(...ends));
}
