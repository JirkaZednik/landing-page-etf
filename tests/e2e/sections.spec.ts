import { test, expect, type Page } from '@playwright/test';

// Redesign 2026-10-13, Task 2: sections below the hero, /dekujeme, legal pages and 404.

const CONSENT = JSON.stringify({ analytics: false, meta: false, ga4: false, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' });
const presetConsent = (page: Page) =>
  page.addInitScript((v) => { try { localStorage.setItem('ix_consent', v); } catch { /* ignore */ } }, CONSENT);

const WHITE = 'rgb(255, 255, 255)';
const CLOUD = 'rgb(243, 246, 255)';
const NIGHT = 'rgb(15, 34, 87)';
const GOLD = 'rgb(255, 201, 60)';

/** Wait until Astro has hydrated the island inside `selector`. */
const hydrated = (page: Page, selector: string) =>
  expect(page.locator(`${selector} astro-island`).first()).not.toHaveAttribute('ssr', /.*/);

async function calcBoxes(page: Page) {
  await presetConsent(page);
  await page.goto('/');
  await page.locator('#kalkulacka').scrollIntoViewIfNeeded();
  await hydrated(page, '#kalkulacka');
  await page.evaluate(() => document.fonts.ready);
  const result = (await page.locator('#kalkulacka [data-testid="calc-result"]').boundingBox())!;
  const input = (await page.locator('#kalkulacka').getByLabel('Měsíční vklad (Kč)').boundingBox())!;
  return { result, input };
}

test.describe('desktop 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test('every section heading on / is centred', async ({ page }) => {
    await presetConsent(page);
    await page.goto('/');
    const aligns = await page.locator('main section[data-section]:not([data-section="hero"])').evaluateAll((els) =>
      els.map((el) => {
        const h = el.querySelector('h2');
        return { id: el.getAttribute('data-section'), align: h ? getComputedStyle(h).textAlign : 'missing' };
      }));
    expect(aligns.length).toBeGreaterThanOrEqual(5);
    for (const a of aligns) expect(a, a.id!).toEqual({ id: a.id, align: 'center' });
  });

  test('calculator is two columns: visual (result card) left, inputs right', async ({ page }) => {
    const { result, input } = await calcBoxes(page);
    expect(result.x + result.width).toBeLessThanOrEqual(input.x);
    // side by side: the two boxes overlap vertically
    expect(result.y).toBeLessThan(input.y + input.height);
    expect(input.y).toBeLessThan(result.y + result.height);
  });

  test('sections alternate white / cloud and the footer is night', async ({ page }) => {
    await presetConsent(page);
    await page.goto('/');
    const bgs = await page.locator('main section[data-section]:not([data-section="hero"])').evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundColor));
    for (const bg of bgs) expect([WHITE, CLOUD]).toContain(bg);
    for (let i = 1; i < bgs.length; i++) expect(bgs[i], `section ${i}`).not.toBe(bgs[i - 1]);
    await expect(page.locator('[data-section="paticka"]')).toHaveCSS('background-color', NIGHT);
  });
});

test.describe('mobile 390×844', () => {
  test('calculator stacks: inputs above the result card', async ({ page }) => {
    const { result, input } = await calcBoxes(page);
    expect(input.y + input.height).toBeLessThanOrEqual(result.y);
  });

  test('/dekujeme: the PDF button is a gold pill', async ({ page }) => {
    await presetConsent(page);
    await page.goto('/dekujeme');
    const pdf = page.getByRole('link', { name: 'Stáhnout návod (PDF)' });
    await expect(pdf).toHaveCSS('background-color', GOLD);
    await expect(pdf).toHaveCSS('color', NIGHT);
  });

  for (const path of ['/zasady-ochrany-osobnich-udaju', '/cookies']) {
    test(`${path}: text sits in a white card on cloud`, async ({ page }) => {
      await presetConsent(page);
      await page.goto(path);
      await expect(page.locator('main.legal')).toHaveCSS('background-color', CLOUD);
      await expect(page.locator('main.legal .legal__card')).toHaveCSS('background-color', WHITE);
    });
  }
});

test.describe('360 px wide: no horizontal scroll', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const path of ['/dekujeme', '/zasady-ochrany-osobnich-udaju', '/cookies', '/neexistujici-stranka']) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(sw).toBeLessThanOrEqual(iw);
    });
  }
});
