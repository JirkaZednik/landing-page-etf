// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Font } from '@react-pdf/renderer';

// Redesign 2026-10-13: the guide PDF uses the site fonts (Bricolage Grotesque + Figtree) as static TTFs
// with Czech diacritics, committed with their OFL licences; the broadsheet fonts are gone.
const DIR = 'public/fonts/pdf';
const TTF = {
  'BricolageGrotesque-SemiBold.ttf': ['Bricolage Grotesque', 600],
  'BricolageGrotesque-ExtraBold.ttf': ['Bricolage Grotesque', 800],
  'Figtree-Regular.ttf': ['Figtree', 400],
  'Figtree-Bold.ttf': ['Figtree', 700],
} as const;

describe('PDF fonts', () => {
  it('ships exactly the new TTFs and their OFL licences', () => {
    expect(readdirSync(DIR).sort()).toEqual(
      [...Object.keys(TTF), 'OFL-bricolage-grotesque.txt', 'OFL-figtree.txt'].sort(),
    );
    for (const f of Object.keys(TTF)) expect(readFileSync(`${DIR}/${f}`).subarray(0, 4).toString('hex'), f).toBe('00010000');
    for (const l of ['OFL-bricolage-grotesque.txt', 'OFL-figtree.txt'])
      expect(readFileSync(`${DIR}/${l}`, 'utf8')).toContain('SIL Open Font License, Version 1.1');
  });

  it('old broadsheet fonts are gone', () => {
    for (const f of ['text-regular.ttf', 'text-bold.ttf', 'mono-regular.ttf', 'OFL-newsreader.txt', 'OFL-ibm-plex-mono.txt'])
      expect(existsSync(`${DIR}/${f}`), f).toBe(false);
  });

  it('GuideDocument registers Bricolage Grotesque and Figtree from these files', async () => {
    await import('../../src/pdf/GuideDocument');
    expect(Font.getRegisteredFontFamilies()).toEqual(expect.arrayContaining(['Bricolage Grotesque', 'Figtree']));
    expect(Font.getRegisteredFontFamilies()).not.toEqual(expect.arrayContaining(['IxText']));
    for (const [file, [family, weight]] of Object.entries(TTF)) {
      const src = String((Font.getFont({ fontFamily: family, fontWeight: weight }) as { src: string }).src);
      expect(src.replace(/\\/g, '/'), `${family} ${weight}`).toMatch(new RegExp(`/public/fonts/pdf/${file}$`));
    }
  });
});
