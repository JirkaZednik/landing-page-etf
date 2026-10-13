import { test, expect } from '@playwright/test';

test('homepage returns 200, lang cs, indexable, white background', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https?:\/\/.+\/og\.png$/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(255, 255, 255)'); // redesign 2026-10-13: --white
});

test('unknown URL renders 404 page with noindex', async ({ page }) => {
  const res = await page.goto('/neexistujici-stranka');
  expect(res?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.getByRole('link', { name: 'Zpět na úvod' })).toHaveAttribute('href', '/');
});
