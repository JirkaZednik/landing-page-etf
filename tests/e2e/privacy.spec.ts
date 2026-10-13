import { test, expect } from '@playwright/test';

const CONSENT = JSON.stringify({ analytics: false, meta: false, ga4: false, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' });

test('privacy page content', async ({ page }) => {
  await page.addInitScript((v) => { try { localStorage.setItem('ix_consent', v); } catch { /* ignore */ } }, CONSENT);
  await page.goto('/zasady-ochrany-osobnich-udaju');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zásady zpracování osobních údajů');
  for (const h of ['Správce', 'Účely a právní základ', 'Seznam partnerů', 'Zpracovatelé', 'Doba uložení', 'Vaše práva'])
    await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  await expect(page.locator('main')).toContainText('ETF Dvojče – ukázkový projekt, e-mail etf-dvojce@seznam.cz');
  await expect(page.locator('main')).toContainText('Ukázkový projekt vytvořený jako zadání pro přijímací řízení. Nejde o nabídku investičních služeb.');
  await expect(page.locator('main')).not.toContainText('IČO');
  await expect(page.locator('main')).toContainText('vaše údaje v něm nepředáváme nikomu');
  for (const p of ['Brevo', 'PostHog', 'Vercel', 'Upstash', 'Meta Platforms Ireland', 'Google Ireland Ltd.']) await expect(page.locator('main')).toContainText(p);
  // Meta Conversions API data (src/server/meta-capi.ts), same wording as /cookies.
  await expect(page.locator('main')).toContainText('hash e-mailu, IP adresa, prohlížeč (Conversions API, jen se souhlasem)');
  await expect(page.locator('main')).toContainText('Dokud zde seznam není uveden, vaše údaje žádnému partnerovi nepředáváme.');
  await expect(page.getByRole('link', { name: 'www.uoou.gov.cz' })).toHaveAttribute('href', 'https://uoou.gov.cz');
  await expect(page.locator('main')).not.toContainText(/TODO|TBD|\[doplnit\]|lorem/i);
});
