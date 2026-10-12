import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

declare global {
  interface Window { __cls: number; __events: { name: string; props: Record<string, unknown> }[] }
}

const data = JSON.parse(readFileSync(new URL('../../src/data/etf-pairs.json', import.meta.url), 'utf8')) as { asOf: string };
const [y, m, d] = data.asOf.split('-').map(Number);
const AS_OF_CZ = `${d}. ${m}. ${y}`;

const CONSENT = JSON.stringify({ analytics: false, meta: false, ga4: false, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' });
const presetConsent = (page: Page) =>
  page.addInitScript((v) => { try { localStorage.setItem('ix_consent', v); } catch { /* ignore */ } }, CONSENT);

const collectEvents = (page: Page) =>
  page.addInitScript(() => {
    window.__events = [];
    window.addEventListener('ix:track', (e) => window.__events.push((e as CustomEvent).detail));
  });

// Stand-in for the rest of the page (Task 11): a tall block and a last link, as a footer would have.
const lengthenPage = () => {
  const spacer = document.createElement('div');
  spacer.style.height = '3000px';
  const last = document.createElement('a');
  last.href = '#';
  last.id = 'e2e-last-link';
  last.textContent = 'Poslední odkaz';
  document.body.append(spacer, last);
};

async function measure(page: Page, url: string) {
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => {
      const s = e as PerformanceEntry & { hadRecentInput: boolean; value: number };
      if (!s.hadRecentInput) window.__cls += s.value;
    })).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  return {
    box: await page.locator('#form button[type=submit]').boundingBox(),
    cls: await page.evaluate(() => window.__cls),
  };
}

test.describe('with consent decided', () => {
  test.beforeEach(({ page }) => presetConsent(page));

  for (const [label, url] of [['bez UTM', '/'], ['a', '/?utm_content=a'], ['b', '/?utm_content=b']] as const) {
    test(`hero form button above fold – ${label}`, async ({ page }) => {
      const { box, cls } = await measure(page, url);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
      expect(box!.y + box!.height).toBeLessThanOrEqual(660); // iOS Safari s lištami
      expect(cls).toBeLessThan(0.01);
      await expect(page.locator('[data-sticky-cta]')).toBeHidden();
    });
  }

  test('variant b shows h1 B, hides h1 A', async ({ page }) => {
    await page.goto('/?utm_content=b');
    await expect(page.locator('html')).toHaveAttribute('data-variant', 'b');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('S&P 500 u vašeho brokera: který fond vybrat a jak ho najít.');
    await expect(page.locator('h1:visible')).toHaveCount(1);
  });

  test('default shows h1 A', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-variant', 'a');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('U evropského brokera VOO jako drobný investor nekoupíte. Jeho evropské dvojče ano.');
  });

  test('answer card: originals, twins sorted by TER, source, ISIN on tap', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-answer-card]');
    await expect(card).toContainText('Originál (NYSE Arca): VOO 0,03 % · SPY 0,09 % · IVV 0,03 %');
    await expect(card.locator('[data-twin]')).toHaveText([/^SPYL/, /^CSPX/, /^VUAA/]);
    await expect(card).toContainText(`Zdroj: vydavatelé fondů, k ${AS_OF_CZ}`);
    await expect(card.getByText('IE000XZSV718')).toBeHidden();
    await card.locator('[data-twin="SPYL"] summary').click();
    await expect(card.getByText('IE000XZSV718')).toBeVisible();
    await expect(card.locator('[data-twin="SPYL"] a', { hasText: 'KID' })).toHaveAttribute('href', /^https:\/\//);
  });

  test('hero form has placement hero directly under card', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#form input[name="placement"]')).toHaveValue('hero');
    const cardBox = await page.locator('[data-answer-card]').boundingBox();
    const formBox = await page.locator('#form').boundingBox();
    expect(formBox!.y).toBeGreaterThan(cardBox!.y + cardBox!.height - 1);
    expect(formBox!.y - (cardBox!.y + cardBox!.height)).toBeLessThanOrEqual(24);
  });

  test('exactly one page_view, carrying hero_variant from utm_content', async ({ page }) => {
    await collectEvents(page);
    await page.goto('/?utm_content=b_isin_9x16');
    await expect.poll(() => page.evaluate(() => window.__events.filter((e) => e.name === 'page_view').length)).toBe(1);
    await page.waitForTimeout(500);
    const views = await page.evaluate(() => window.__events.filter((e) => e.name === 'page_view'));
    expect(views).toHaveLength(1);
    expect(views[0].props).toMatchObject({ hero_variant: 'b', utm_content: 'b_isin_9x16' });
  });

  test('source link click is tracked', async ({ page, context }) => {
    await collectEvents(page);
    await page.goto('/');
    await page.locator('[data-twin="CSPX"] summary').click();
    const popup = context.waitForEvent('page');
    await page.locator('[data-source-link="CSPX"]').first().click();
    (await popup).close();
    await expect.poll(() => page.evaluate(() => window.__events.find((e) => e.name === 'source_link_clicked')?.props))
      .toEqual({ fund: 'CSPX' });
  });

  test('sticky CTA appears after scrolling past the form and jumps back to it', async ({ page }) => {
    await collectEvents(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const sticky = page.locator('[data-sticky-cta]');
    await expect(sticky).toBeHidden();
    // Task 9 page has only the hero; give it length so the form can leave the viewport.
    await page.evaluate(lengthenPage);
    await page.evaluate(() => window.scrollTo(0, 2500));
    await expect(sticky).toBeVisible();
    await sticky.getByRole('button', { name: 'Pošlete mi návod zdarma' }).click();
    await expect(page.locator('#form input[name="email"]')).toBeFocused();
    await expect(sticky).toBeHidden();
    const ev = await page.evaluate(() => window.__events.find((e) => e.name === 'sticky_cta_clicked')?.props);
    expect(ev).toEqual({ target: 'form-0' });
  });

  test('while the sticky bar is shown, the page bottom scrolls fully above it', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(lengthenPage);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const sticky = page.locator('[data-sticky-cta]');
    await expect(sticky).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-sticky-bar', 'shown');
    // the bar appeared after the scroll; scroll to the (now taller) bottom again
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bar = (await sticky.boundingBox())!;
    const last = (await page.locator('#e2e-last-link').boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(bar.y);
  });
});

test.describe('consent banner open (first visit)', () => {
  test('hero button is above the banner and not covered by it', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('region', { name: 'Souhlas s cookies' });
    await expect(banner).toBeVisible();
    const btn = page.locator('#form button[type=submit]');
    const b = (await btn.boundingBox())!;
    const bannerBox = (await banner.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(bannerBox.y);
    const hit = await page.evaluate(([x, yy]) => {
      const el = document.elementFromPoint(x, yy);
      return !!el?.closest('#form button[type=submit]');
    }, [b.x + b.width / 2, b.y + b.height / 2]);
    expect(hit).toBe(true);
  });

  test('sticky CTA stays hidden while the banner is open', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Souhlas s cookies' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.evaluate(lengthenPage);
    await page.evaluate(() => window.scrollTo(0, 2500));
    await page.waitForTimeout(300);
    await expect(page.locator('[data-sticky-cta]')).toBeHidden();
  });
});
