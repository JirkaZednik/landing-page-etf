import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

declare global {
  interface Window { __events: { name: string; props: Record<string, unknown> }[] }
}

const data = JSON.parse(readFileSync(new URL('../../src/data/etf-pairs.json', import.meta.url), 'utf8')) as { asOf: string };
const [y, m, d] = data.asOf.split('-').map(Number);
const AS_OF_CZ = `${d}. ${m}. ${y}`;

const CONSENT = JSON.stringify({ analytics: false, meta: false, ga4: false, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' });

/** Preset the cookie decision (banner closed) and collect `ix:track` events. */
const setup = (page: Page, { consent = true } = {}) =>
  page.addInitScript(({ v, consent }) => {
    if (consent) try { localStorage.setItem('ix_consent', v); } catch { /* ignore */ }
    window.__events = [];
    window.addEventListener('ix:track', (e) => window.__events.push((e as CustomEvent).detail));
  }, { v: CONSENT, consent });

const events = (page: Page, name: string) =>
  page.evaluate((n) => window.__events.filter((e) => e.name === n).map((e) => e.props), name);

test.describe('homepage', () => {
  test.beforeEach(({ page }) => setup(page));

  test('sections in spec §4 order', async ({ page }) => {
    await page.goto('/');
    const order = await page.locator('[data-section]').evaluateAll(els => els.map(e => e.getAttribute('data-section')));
    expect(order).toEqual(['hero', 'fondy', 'kalkulacka', 'proc-ne', 'navod', 'faq', 'paticka']);
  });

  test('lead forms and placements', async ({ page }) => {
    await page.goto('/');
    const placements = await page.locator('form[action="/api/subscribe"] input[name="placement"]').evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
    expect(placements).toEqual(['hero', 'calc', 'preview']);
    await expect(page.locator('#form')).toHaveCount(1);
  });

  test('why-not section text and sources', async ({ page }) => {
    await page.goto('/');
    const s = page.locator('[data-section="proc-ne"]');
    await expect(s.getByRole('heading', { level: 2 })).toHaveText('Proč VOO u evropského brokera nekoupíte');
    await expect(s).toContainText('Pokud americké ETF už držíte, můžete je dál držet i prodat.');
    await expect(s.getByRole('link', { name: 'justETF' })).toHaveAttribute('href', 'https://www.justetf.com/en/news/etf/us-domiciled-etfs.html');
    await expect(s.getByRole('link', { name: 'Nařízení (EU) č. 1286/2014 (PRIIPs)' })).toHaveAttribute('href', 'https://eur-lex.europa.eu/eli/reg/2014/1286/oj');
  });

  test('why-not source link click is tracked once', async ({ page }) => {
    await page.goto('/');
    // Keep the click on this page: block navigation, but let delegated listeners run.
    await page.evaluate(() => window.addEventListener('click', (e) => e.preventDefault(), true));
    await page.locator('[data-section="proc-ne"]').getByRole('link', { name: 'justETF' }).click();
    expect(await events(page, 'source_link_clicked')).toEqual([{ fund: 'priips' }]);
  });

  test('guide copy mentions the e-mail confirmation (double opt-in)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-section="navod"]')).toContainText('Pošleme ho na váš e-mail po jeho potvrzení.');
    await expect(page.locator('[data-section="faq"] details').first()).toContainText('po potvrzení e-mailu');
  });

  test('faq: 5 questions, operator question', async ({ page }) => {
    await page.goto('/');
    const faq = page.locator('[data-section="faq"] details');
    await expect(faq).toHaveCount(5);
    const q = faq.filter({ hasText: 'Kdo za tím stojí a co se stane s mými údaji?' });
    await q.locator('summary').click();
    await expect(q).toContainText('Clientelo Czech s.r.o.');
    await expect(q).toContainText('22193456');
    await expect.poll(() => events(page, 'faq_opened')).toEqual([{ question: 5 }]);
  });

  test('faq: tax answer cites § 4 of zákon č. 586/1992 Sb. without an unverified letter', async ({ page }) => {
    await page.goto('/');
    const q = page.locator('[data-section="faq"] details').filter({ hasText: 'Není evropské dvojče daňově horší?' });
    const link = q.locator('.faq__src a');
    await expect(link).toHaveText('Zákon o daních z příjmů (č. 586/1992 Sb.), § 4');
    await expect(link).toHaveAttribute('href', 'https://www.zakonyprolidi.cz/cs/1992-586');
    await expect(page.locator('[data-section="faq"]')).not.toContainText('písm.');
  });

  test('footer: operator, disclaimers, sources, cookie settings', async ({ page }) => {
    await page.goto('/');
    const f = page.locator('[data-section="paticka"]');
    for (const t of ['Clientelo Czech s.r.o.', 'IČO 22193456', 'Platnéřská 90/13', 'fundraising@clientelo.cz',
      'nejsou investičním doporučením', 'nemusí se vám vrátit celá vložená částka', 'nejsou příslibem budoucího výnosu',
      'Ochranné známky patří jejich vlastníkům; stránka s vydavateli fondů nespolupracuje.']) await expect(f).toContainText(t);
    await expect(f.getByRole('link', { name: 'Zásady zpracování osobních údajů' })).toHaveAttribute('href', '/zasady-ochrany-osobnich-udaju');
    await expect(f.getByRole('link', { name: 'Cookies' })).toHaveAttribute('href', '/cookies');
    await expect(page.locator('#zdroje')).toContainText(`k ${AS_OF_CZ}`);
    await expect(page.locator('#zdroje')).toContainText('Fidelity');
    await expect(page.locator('#zdroje a[href="https://fund-docs.vanguard.com/F0968.pdf"]')).toHaveCount(1);
    await f.getByRole('button', { name: 'Nastavení cookies' }).click();
    await expect(page.getByRole('region', { name: 'Souhlas s cookies' })).toBeVisible(); // ConsentBanner z Task 5
  });

  test('scroll_depth fires once per threshold', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(150);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
    }
    expect(await events(page, 'scroll_depth')).toEqual([{ percent: 25 }, { percent: 50 }, { percent: 75 }, { percent: 100 }]);
  });
});
