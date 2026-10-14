import raw from '../data/etf-pairs.json';
import brokersRaw from '../data/brokers.json';
import type { Broker, BrokerId, EtfData, Fund, Group, GroupId } from './types';

const DATA = raw as unknown as EtfData;
const BROKERS = brokersRaw as unknown as Broker[];

const GROUP_IDS: GroupId[] = ['sp500', 'world', 'us-total', 'us-dividend'];
const SOURCED_FIELDS = ['name', 'isin', 'ter', 'exchange', 'domicile', 'distribution', 'replication', 'index'] as const;

export function getData(): EtfData {
  return DATA;
}

export function getGroup(id: GroupId): Group {
  const g = DATA.groups.find((x) => x.id === id);
  if (!g) throw new Error('Unknown group: ' + id);
  return g;
}

export function getFund(id: string): Fund {
  const f = Object.hasOwn(DATA.funds, id) ? DATA.funds[id] : undefined;
  if (!f) throw new Error('Unknown fund: ' + id);
  return f;
}

export function originalsOf(id: GroupId): Fund[] {
  return getGroup(id).originals.map(getFund);
}

export function twinsSortedByTer(id: GroupId): Fund[] {
  return getGroup(id)
    .twins.map(getFund)
    .sort((a, b) => a.ter.value - b.ter.value || a.id.localeCompare(b.id));
}

// Primary sources only: fund issuers and SEC filings (aggregators are not allowed).
const SOURCE_HOSTS = [
  'vanguard', // de.vanguard, nl.vanguard
  'vanguard.com',
  'vanguard.co.uk',
  'vanguardsouthamerica.com',
  'ssga.com',
  'ishares.com',
  'blackrock.com',
  'schwabassetmanagement.com',
  'invesco.com',
  'fidelity.co.uk',
  'fidelityinternational.com',
  'sec.gov',
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isAllowedHost(host: string): boolean {
  return SOURCE_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

function isIsoDate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isValidIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false;
  const digits = [...isin].map((c) => parseInt(c, 36)).join('');
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export function validateData(d: EtfData): string[] {
  const errors: string[] = [];
  if (!isIsoDate(d.asOf)) errors.push('asOf: must be YYYY-MM-DD');

  for (const [key, f] of Object.entries(d.funds)) {
    if (f.id !== key) errors.push(`funds.${key}.id: must equal key`);
    if (f.id === 'QQQ') errors.push('funds.QQQ: QQQ is excluded');
    for (const field of SOURCED_FIELDS) {
      const s = f[field];
      if (typeof s.sourceUrl !== 'string' || !s.sourceUrl.startsWith('https://'))
        errors.push(`funds.${f.id}.${field}.sourceUrl: must be https`);
      else if (!isAllowedHost(hostOf(s.sourceUrl)))
        errors.push(`funds.${f.id}.${field}: sourceUrl host not allowed: ${hostOf(s.sourceUrl)}`);
      if (!isIsoDate(s.asOf)) errors.push(`funds.${f.id}.${field}.asOf: must be YYYY-MM-DD`);
    }
    if (!isValidIsin(f.isin.value)) errors.push(`funds.${f.id}.isin: invalid ISIN`);
    if (!(f.ter.value > 0 && f.ter.value < 2)) errors.push(`funds.${f.id}.ter: out of range`);
    if (f.replication.value === 'synthetic')
      errors.push(`funds.${f.id}.replication: synthetic funds are not allowed`);
    if (f.kind === 'us' && f.exchange.value !== 'NYSE Arca')
      errors.push(`funds.${f.id}.exchange: US original must trade on NYSE Arca`);
    if (f.kidUrl !== undefined && !f.kidUrl.startsWith('https://'))
      errors.push(`funds.${f.id}.kidUrl: must be https`);
    else if (f.kidUrl !== undefined && !isAllowedHost(hostOf(f.kidUrl)))
      errors.push(`funds.${f.id}.kidUrl: sourceUrl host not allowed: ${hostOf(f.kidUrl)}`);
  }

  for (const id of GROUP_IDS) {
    const n = d.groups.filter((g) => g.id === id).length;
    if (n === 0) errors.push(`groups: missing ${id}`);
    if (n > 1) errors.push(`groups: duplicate ${id}`);
  }

  for (const g of d.groups) {
    for (const list of ['originals', 'twins'] as const) {
      const wanted = list === 'originals' ? 'us' : 'ucits';
      for (const fid of g[list]) {
        const f = Object.hasOwn(d.funds, fid) ? d.funds[fid] : undefined;
        if (!f) errors.push(`groups.${g.id}.${list}: unknown fund ${fid}`);
        else if (f.kind !== wanted) errors.push(`groups.${g.id}.${list}: ${fid} must be kind ${wanted}`);
      }
    }
    if (g.originals.length < 1) errors.push(`groups.${g.id}.originals: empty`);
    if ((g.exactTwin || g.calcEnabled) && g.twins.length < 2)
      errors.push(`groups.${g.id}.twins: at least 2 required`);
  }
  return errors;
}

// Broker facts must be sourced from the brokers' own sites (degiro.cz, degiro.com, ...).
const BROKER_HOSTS = ['xtb.com', 'trading212.com', 'fio.cz', 'degiro.cz', 'degiro.com'];
const BROKER_IDS: BrokerId[] = ['xtb', 'trading212', 'fio', 'degiro'];

function isBrokerHost(host: string): boolean {
  return BROKER_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

export function getBrokers(): Broker[] {
  return BROKERS;
}

export function getBroker(id: BrokerId): Broker {
  const b = BROKERS.find((x) => x.id === id);
  if (!b) throw new Error('Unknown broker: ' + id);
  return b;
}

/** Brokers with at least one fund verified as available on their own site. Only these may be
 *  promised before the e-mail (hero, ads); the others stay in the picker and PDF as "not verified". */
export function verifiedBrokers(): Broker[] {
  return BROKERS.filter((b) => b.listings.some((l) => l.available.value === true));
}

export function twinsAtBroker(b: BrokerId, g: GroupId): { fund: Fund; ticker: string }[] {
  const listings = getBroker(b).listings;
  const out: { fund: Fund; ticker: string }[] = [];
  for (const fund of twinsSortedByTer(g)) {
    const l = listings.find((x) => x.fundId === fund.id);
    if (l && l.available.value === true) out.push({ fund, ticker: l.ticker.value });
  }
  return out;
}

export function validateBrokers(b: Broker[], d: EtfData): string[] {
  const errors: string[] = [];
  if (b.map((x) => x.id).join(',') !== BROKER_IDS.join(','))
    errors.push('brokers: expected ' + BROKER_IDS.join(','));

  const twinIds = new Set(d.groups.flatMap((g) => g.twins));
  const checkSource = (path: string, s: { sourceUrl: string; asOf: string }) => {
    if (typeof s.sourceUrl !== 'string' || !s.sourceUrl.startsWith('https://'))
      errors.push(`${path}.sourceUrl: must be https`);
    else if (!isBrokerHost(hostOf(s.sourceUrl)))
      errors.push(`${path}: sourceUrl host not allowed: ${hostOf(s.sourceUrl)}`);
    if (!isIsoDate(s.asOf)) errors.push(`${path}.asOf: must be YYYY-MM-DD`);
  };

  for (const br of b) {
    const p = `brokers.${br.id}`;
    if (!isIsoDate(br.asOf)) errors.push(`${p}.asOf: must be YYYY-MM-DD`);
    checkSource(`${p}.buyFee`, br.buyFee);
    checkSource(`${p}.steps`, br.steps);
    if (typeof br.buyFee.value !== 'string' || br.buyFee.value.trim() === '') errors.push(`${p}.buyFee: empty`);
    if (!Array.isArray(br.steps.value) || br.steps.value.length < 1) errors.push(`${p}.steps: empty`);

    const seen = new Set<string>();
    for (const l of br.listings) {
      const lp = `${p}.listings.${l.fundId}`;
      if (!Object.hasOwn(d.funds, l.fundId)) errors.push(`${lp}: unknown fund`);
      else if (!twinIds.has(l.fundId)) errors.push(`${lp}: not a UCITS twin`);
      if (seen.has(l.fundId)) errors.push(`${lp}: duplicate`);
      seen.add(l.fundId);
      checkSource(`${lp}.ticker`, l.ticker);
      checkSource(`${lp}.available`, l.available);
      if (!/^[A-Z0-9.]{2,12}$/.test(l.ticker.value)) errors.push(`${lp}.ticker: invalid`);
    }
  }
  return errors;
}
