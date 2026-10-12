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

test('/dekujeme flow: broker → phone with (a) without (b)', async ({ page }) => {
  await page.goto(`/dekujeme?aid=${AID}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ještě jeden klik: potvrďte e-mail');
  await expect(page.getByRole('link', { name: 'Otevřít Gmail' })).toHaveAttribute('href', 'https://mail.google.com/');
  await expect(page.getByRole('link', { name: 'Otevřít Seznam Email' })).toHaveAttribute('href', 'https://email.seznam.cz/');
  await expect(page.locator('.sticky-cta')).toHaveCount(0);
  await expect.poll(() => events(page, 'thankyou_viewed')).toHaveLength(1);

  await hydrated(page, '.broker-picker');
  await page.getByRole('radio', { name: 'XTB' }).check();
  await expect.poll(() => bodies[0]).toEqual({ aid: AID, broker: 'xtb', consent_text_version: '2026-10-11' });
  await expect(page.getByTestId('broker-twin').first()).toBeVisible();

  await page.locator('.phone-offer').scrollIntoViewIfNeeded();
  await hydrated(page, '.phone-offer'); // client:visible
  await page.getByLabel('Telefon', { exact: true }).fill('777 123 456');
  await page.getByLabel(/telefonicky kontaktoval/).check();
  await page.getByRole('button', { name: 'Zavolejte mi' }).click();
  await expect(page.getByText('Děkujeme, číslo máme. Ozveme se vám.')).toBeVisible();
  expect(bodies[1]).toEqual({ aid: AID, phone: '+420777123456', consent_call: true, consent_partners: false, consent_text_version: '2026-10-11' });
});

test('/potvrzeno: PDF link, phone offer note, noindex', async ({ page }) => {
  await page.goto(`/potvrzeno?aid=${AID}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: 'Stáhnout návod (PDF)' })).toHaveAttribute('href', '/navod-etf.pdf');
  await expect(page.getByText('Pokud jste telefon už zadali, nemusíte nic dělat.')).toBeVisible();
  await expect(page.locator('.sticky-cta')).toHaveCount(0);
  await expect.poll(() => events(page, 'doi_confirmed')).toHaveLength(1);

  // the PDF exists only after Task 13: stop the navigation, check only the event
  await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault()));
  await page.getByRole('link', { name: 'Stáhnout návod (PDF)' }).click();
  await expect.poll(() => events(page, 'pdf_downloaded')).toHaveLength(1);
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
  await expect.poll(() => bodies[0]).toEqual({ aid: AID, broker: 'degiro', consent_text_version: '2026-10-11' });
});
