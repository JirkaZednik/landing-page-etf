import raw from '../data/etf-pairs.json';
import type { EtfData, Fund, Group, GroupId } from './types';

const DATA = raw as unknown as EtfData;

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
