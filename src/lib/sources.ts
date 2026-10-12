import type { EtfData, Fund, Sourced } from './types';

/** Issuer domains → publisher name. A host matches its domain or any subdomain of it. */
const ISSUERS: [domains: string[], name: string][] = [
  [['vanguard.com', 'vanguard', 'vanguardsouthamerica.com'], 'Vanguard'], // `.vanguard` is Vanguard's own TLD (de.vanguard)
  [['ssga.com'], 'State Street Global Advisors'],
  [['ishares.com'], 'iShares'],
  [['schwabassetmanagement.com'], 'Charles Schwab'],
  [['fidelityinternational.com'], 'Fidelity'],
];

const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Publisher of an issuer page, or null for anything else (e.g. SEC EDGAR filings). */
export function publisherOf(url: string): string | null {
  const host = new URL(url).hostname;
  return ISSUERS.find(([domains]) => domains.some((d) => matches(host, d)))?.[1] ?? null;
}

export interface SourceRef { url: string; host: string; asOf: string }

const sourcedFields = (f: Fund): Sourced<unknown>[] =>
  Object.values(f).filter((v): v is Sourced<unknown> => typeof v === 'object' && v !== null && 'sourceUrl' in v);

/** Every distinct source (URL + date) behind each fund's values, in data order. */
export function fundSources(d: EtfData): { fundId: string; sources: SourceRef[] }[] {
  return Object.values(d.funds).map((f) => {
    const seen = new Set<string>();
    const sources: SourceRef[] = [];
    for (const s of sourcedFields(f)) {
      const key = `${s.sourceUrl} ${s.asOf}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({ url: s.sourceUrl, host: new URL(s.sourceUrl).hostname.replace(/^www\./, ''), asOf: s.asOf });
    }
    return { fundId: f.id, sources };
  });
}

/** Issuers whose pages back the data, in order of first use. */
export function publishersInData(d: EtfData): string[] {
  const out: string[] = [];
  for (const f of fundSources(d))
    for (const s of f.sources) {
      const p = publisherOf(s.url);
      if (p && !out.includes(p)) out.push(p);
    }
  return out;
}
