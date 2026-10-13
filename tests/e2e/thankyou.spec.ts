import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window { __events: { name: string; props: Record<string, unknown> }[] }
}

// getAid() accepts ?aid= only when it is a UUID
const AID = '0b7c5a0e-3f7e-4c1a-9a1b-2c3d4e5f6a7b';
const CONSENT = JSON.stringify({ analytics: false, meta: false, ga4: false, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' });

let bodies: unknown[];

const events = (page: Page, name: string) =>
  page.evaluate((n) => window.__events.filter((e) => e.name === n).map((e) => e.props), name);

/** Wait until Astro has hydrated the island that contains `selector` (a check before that is lost). */
const hydrated = (page: Page, selector: string) =>
  expect(page.locator('astro-island').filter({ has: page.locator(selector) })).not.toHaveAttribute('ssr', /.*/);

test.beforeEach(async ({ page }) => {
  bodies = [];
  await page.addInitScript((v) => {
    try { localStorage.setItem('ix_consent', v); } catch { /* ignore */ }
    window.__events = [];
    window.addEventListener('ix:track', (e) => window.__events.push((e as CustomEvent).detail));
  }, CONSENT);
  await page.route('**/api/profile', (r) => {
    bodies.push(r.request().postDataJSON());
    return r.fulfill({ json: { ok: true } });
  });
});

test('/dekujeme flow: guide PDF at once → broker → phone with (a) without (b)', async ({ page }) => {
  await page.goto(`/dekujeme?aid=${AID}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hotovo. Návod je váš.');
  const pdf = page.getByRole('link', { name: 'Stáhnout návod (PDF)' });
  await expect(pdf).toHaveAttribute('href', '/navod-etf.pdf');
  await expect(pdf).toHaveAttribute('download', /.*/);
  await expect(page.getByText('Stejný návod jsme vám poslali i e-mailem.')).toBeVisible();
  await expect(page.locator('.sticky-cta')).toHaveCount(0);
  await expect.poll(() => events(page, 'thankyou_viewed')).toHaveLength(1);

  // single opt-in: nothing to confirm, no mailbox shortcuts
  const main = page.locator('main');
  await expect(main).not.toContainText(/potvr/i);
  await expect(page.getByRole('link', { name: /Gmail|Seznam Email/ })).toHaveCount(0);

  // order: heading → PDF button → broker picker → phone offer
  const order = await page.evaluate(() => {
    const els = ['h1', 'a[href="/navod-etf.pdf"]', '.broker-picker', '.phone-offer'].map((s) => document.querySelector(s));
    return els.slice(1).map((el, i) =>
      !!el && !!els[i] && (els[i]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
  });
  expect(order).toEqual([true, true, true]);

  // the click must be tracked; keep the browser on the page
  await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault(), { once: true }));
  await pdf.click();
  await expect.poll(() => events(page, 'pdf_downloaded')).toHaveLength(1);

  await hydrated(page, '.broker-picker');
  await page.getByRole('radio', { name: 'XTB' }).check();
  await expect.poll(() => bodies[0]).toEqual({ aid: AID, broker: 'xtb', consent_text_version: '2026-10-13' });
  await expect(page.getByTestId('broker-twin').first()).toBeVisible();

  await page.locator('.phone-offer').scrollIntoViewIfNeeded();
  await hydrated(page, '.phone-offer'); // client:visible
  await expect(page.getByText('Pokud jste telefon už zadali, nemusíte nic dělat.')).toHaveCount(0);
  await page.getByLabel('Telefon', { exact: true }).fill('777 123 456');
  await page.getByLabel(/telefonicky kontaktoval/).check();
  await page.getByRole('button', { name: 'Zavolejte mi' }).click();
  await expect(page.getByText('Děkujeme, číslo máme. Ozveme se vám.')).toBeVisible();
  expect(bodies[1]).toEqual({ aid: AID, phone: '+420777123456', consent_call: true, consent_partners: false, consent_text_version: '2026-10-13' });
});

// Review Focus 2: opened from history / bookmark without ?aid=
test('/dekujeme without aid: PDF download works, no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/dekujeme');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hotovo. Návod je váš.');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Stáhnout návod (PDF)' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('navod-etf.pdf');
  await expect.poll(() => events(page, 'pdf_downloaded')).toHaveLength(1);
  await hydrated(page, '.broker-picker');
  expect(errors).toEqual([]);
});

// Review Focus 3: /potvrzeno is gone (on Vercel: 301 → /dekujeme via vercel.json, see production.spec.ts)
test('/potvrzeno no longer exists in the app', async ({ request }) => {
  const r = await request.get(`/potvrzeno?aid=${AID}`, { maxRedirects: 0 });
  expect(r.status()).toBe(404);
});

test('hero form → /dekujeme with aid → broker choice', async ({ page }) => {
  await page.route('**/api/subscribe', (r) => r.fulfill({ json: { ok: true, redirect: `/dekujeme?aid=${AID}` } }));
  await page.goto('/');
  // LeadForm is client:load: submit only after hydration (otherwise the no-JS POST runs)
  await expect(page.locator('#form')).toHaveAttribute('novalidate', '');
  await page.locator('#form').getByLabel('Váš e-mail').fill('jan@example.cz');
  await page.locator('#form').getByRole('button', { name: 'Pošlete mi návod' }).click();
  await expect(page).toHaveURL(`/dekujeme?aid=${AID}`);
  await hydrated(page, '.broker-picker');
  await page.getByRole('radio', { name: 'Degiro' }).check();
  await expect.poll(() => bodies[0]).toEqual({ aid: AID, broker: 'degiro', consent_text_version: '2026-10-13' });
});
