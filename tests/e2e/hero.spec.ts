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
    // Give the page length past the last form, then scroll to the very bottom: every lead form
    // (hero #form, and the calculator form since Task 10) is above, so the bar jumps back to the last one.
    await page.evaluate(lengthenPage);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(sticky).toBeVisible();
    const forms = page.locator('form[action="/api/subscribe"]');
    const last = (await forms.count()) - 1;
    await sticky.getByRole('button', { name: 'Pošlete mi návod zdarma' }).click();
    await expect(forms.nth(last).locator('input[name="email"]')).toBeFocused();
    await expect(sticky).toBeHidden();
    const ev = await page.evaluate(() => window.__events.find((e) => e.name === 'sticky_cta_clicked')?.props);
    expect(ev).toEqual({ target: `form-${last}` });
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

// Final review Critical 1: with the woff2 files blocked (slow 4G, font request failed) the hero laid
// out in the size-adjusted fallback must match the web-font layout, so the swap cannot shift it.
test.describe('web fonts blocked (metric-matched fallback)', () => {
  test.beforeEach(({ page }) => presetConsent(page));

  const buttonBottom = async (page: Page, url: string) => {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    const box = await page.locator('#form button[type=submit]').boundingBox();
    return box!.y + box!.height;
  };

  for (const [label, url] of [['bez UTM', '/'], ['a', '/?utm_content=a'], ['b', '/?utm_content=b']] as const) {
    test(`hero button stays put without web fonts – ${label}`, async ({ page, context }) => {
      // Blocked run first, in a page that has never loaded the fonts (no memory-cache hits).
      // .woff too: @fontsource lists it as the second src, so blocking only woff2 would just swap later.
      let aborted = 0;
      await page.route(/\.woff2?(\?.*)?$/, (r) => { aborted++; return r.abort(); });
      const without = await buttonBottom(page, url);
      expect(aborted).toBeGreaterThan(0);
      expect(await page.evaluate(() => [...document.fonts].some(
        (f) => f.family.replace(/"/g, '') === 'Bricolage Grotesque' && f.status === 'loaded'))).toBe(false);

      const withFonts = await context.newPage();
      await presetConsent(withFonts);
      const loaded = await buttonBottom(withFonts, url);
      expect(await withFonts.evaluate(() => [...document.fonts].some(
        (f) => f.family.replace(/"/g, '') === 'Bricolage Grotesque' && f.status === 'loaded'))).toBe(true);

      expect(without).toBeLessThanOrEqual(660);
      expect(Math.abs(without - loaded), `loaded ${loaded} px vs fallback ${without} px`).toBeLessThanOrEqual(4);
    });
  }
});

test.describe('redesign (EU blue and gold)', () => {
  test.beforeEach(({ page }) => presetConsent(page));

  test('hero trust row has exactly the three approved texts', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-section="hero"] [data-trust] li')).toHaveText([
      'Data přímo od vydavatelů',
      'Návod pro XTB, Trading 212 a Degiro',
      'Bez registrace',
    ]);
  });

  test('display font Bricolage Grotesque 800 is loaded', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    // check() alone is also true when no face matches, so require a loaded 800 face as well.
    expect(await page.evaluate(() => document.fonts.check('800 20px "Bricolage Grotesque"'))).toBe(true);
    expect(await page.evaluate(() => [...document.fonts].some(
      (f) => f.family.replace(/"/g, '') === 'Bricolage Grotesque' && f.weight === '800' && f.status === 'loaded',
    ))).toBe(true);
    await expect(page.locator('h1:visible')).toHaveCSS('font-family', /Bricolage Grotesque/);
  });

  test('header shows the logo (two circles) and the brand name', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header.masthead');
    await expect(header.locator('svg[aria-hidden="true"] circle')).toHaveCount(2);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0F2257');
  });

  test('hero illustration labels come from data and are hidden from AT', async ({ page }) => {
    await page.goto('/');
    const ill = page.locator('[data-section="hero"] [data-twins-illustration]');
    await expect(ill).toHaveAttribute('aria-hidden', 'true');
    await expect(ill.locator('text')).toHaveText(['VOO', 'SPYL']);
  });

  test('answer card: lowest TER row is marked, badge stays factually qualified', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-answer-card]');
    await expect(card.locator('[data-twin][data-lowest]')).toHaveCount(1);
    await expect(card.locator('[data-twin][data-lowest]')).toHaveAttribute('data-twin', 'SPYL');
    await expect(card.locator('[data-badge]')).toHaveText('u brokerů v EU pro drobné investory nedostupné');
  });

  test('keyboard focus is visible on the hero e-mail field and gold button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const outline = (sel: string) => page.locator(sel).evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
    });
    await page.locator('#form input[name="email"]').focus();
    const field = await outline('#form input[name="email"]');
    expect(field.style).not.toBe('none');
    expect(field.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Tab');
    await expect(page.locator('#form button[type=submit]')).toBeFocused();
    const btn = await outline('#form button[type=submit]');
    expect(btn.style).not.toBe('none');
    expect(btn.width).toBeGreaterThanOrEqual(2);
  });

  test.describe('desktop 1440×900', () => {
    test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

    for (const v of ['a', 'b'] as const) {
      test(`variant ${v}: H1 ≤ 3 lines and the trust row ends above the fold`, async ({ page }) => {
        await page.goto(`/?utm_content=${v}`);
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
        const lines = await page.locator('h1:visible').evaluate((el) =>
          Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
        expect(lines).toBeLessThanOrEqual(3);
        const trust = (await page.locator('[data-section="hero"] [data-trust]').boundingBox())!;
        expect(trust.y + trust.height).toBeLessThanOrEqual(900);
      });
    }
  });

  test.describe('360 px wide', () => {
    test.use({ viewport: { width: 360, height: 780 } });

    test('no horizontal scroll on /', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(sw).toBeLessThanOrEqual(iw);
    });
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
