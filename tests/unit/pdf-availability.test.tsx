// @vitest-environment node
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderToFile } from '@react-pdf/renderer';
import { PDFParse } from 'pdf-parse';
import { sectionFor } from './helpers/pdf-text';

const flipped = vi.hoisted(() => ({ fundId: '' }));

vi.mock('../../src/data/brokers.json', async (importOriginal) => {
  const mod = (await importOriginal()) as { default: unknown };
  const clone = structuredClone(mod.default) as any[];
  const xtb = clone.find((n) => n.id === 'xtb');
  if (!xtb) throw new Error('xtb not found in brokers.json');
  const l = xtb.listings.find((x: any) => x.available.value === true);
  l.available = { ...l.available, value: false };
  flipped.fundId = l.fundId;
  return { default: clone };
});

describe('GuideDocument availability', () => {
  it('does not list a fund in a broker section where available=false', async () => {
    const { GuideDocument } = await import('../../src/pdf/GuideDocument');
    const { getBroker, getFund } = await import('../../src/lib/pairs');
    const out = join(mkdtempSync(join(tmpdir(), 'ix-pdf-')), 'g.pdf');
    await renderToFile(<GuideDocument />, out);
    const p = new PDFParse({ data: readFileSync(out) });
    const text = (await p.getText()).text;
    await p.destroy();

    const isin = getFund(flipped.fundId).isin.value;
    expect(sectionFor(text, getBroker('xtb').name)).not.toContain(isin);
    expect(text.slice(text.indexOf('Všechny páry'))).toContain(isin); // tabulka párů ho dál obsahuje
  }, 60_000);
});
