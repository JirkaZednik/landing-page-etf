import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window { __events: { name: string; props: Record<string, unknown> }[] }
}

const CONSENT = JSON.stringify({ analytics: false, meta: false, ga4: false, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' });

async function setup(page: Page) {
  await page.addInitScript((v) => {
    try { localStorage.setItem('ix_consent', v); } catch { /* ignore */ }
    window.__events = [];
    window.addEventListener('ix:track', (e) => window.__events.push((e as CustomEvent).detail));
  }, CONSENT);
  await page.goto('/');
}

/** client:visible islands: wait until Astro has hydrated the island inside `section`. */
async function hydrated(page: Page, section: string) {
  await page.locator(section).scrollIntoViewIfNeeded();
  await expect(page.locator(`${section} astro-island`)).not.toHaveAttribute('ssr', /.*/);
}

const names = (page: Page) => page.evaluate(() => window.__events.map((e) => e.name));

test('fund card CTA hands over to the hero form with the chosen fund', async ({ page }) => {
  await setup(page);
  await hydrated(page, '#fondy');
  const fondy = page.locator('#fondy');
  await fondy.getByText('SCHD', { exact: true }).click();
  await expect(fondy.getByText('UCITS fond na index Dow Jones U.S. Dividend 100 neexistuje')).toBeVisible();
  await fondy.getByRole('button', { name: 'Poslat návod pro tento fond' }).click();
  await expect(page.locator('#form input[name=pair]')).toHaveValue('us-dividend');
  await expect(page.locator('#form input[name=placement]')).toHaveValue('card');
  await expect(page.locator('#form input[type=email]')).toBeFocused();
  await expect.poll(() => names(page)).toEqual(expect.arrayContaining(['pair_selected', 'card_cta_clicked']));
});

test('calculator recomputes after hydration and its form carries the inputs', async ({ page }) => {
  await setup(page);
  await hydrated(page, '#kalkulacka');
  const calc = page.locator('#kalkulacka');
  const result = calc.getByTestId('calc-result');
  await expect(result).toContainText(/Celkem vložíte 720\s000\sKč/);
  const monthly = calc.getByLabel('Měsíční vklad (Kč)');
  await monthly.fill('5000');
  await expect(result).toContainText(/Celkem vložíte 1\s200\s000\sKč/);
  await calc.getByText('Celý svět', { exact: true }).click();
  await expect(calc.getByTestId('calc-row').first()).toHaveAttribute('data-fund', 'SPYY');
  const form = calc.locator('form');
  await expect(form.locator('input[name=placement]')).toHaveValue('calc');
  await expect(form.locator('input[name=pair]')).toHaveValue('world');
  await expect(form.locator('input[name=calc_deposit]')).toHaveValue('5000');
});

test('world card "Spočítat poplatky" preselects the world group in the calculator', async ({ page }) => {
  await setup(page);
  await hydrated(page, '#kalkulacka');
  await hydrated(page, '#fondy');
  await page.locator('#fondy').getByRole('link', { name: 'Spočítat poplatky v kalkulačce' }).click();
  await expect(page.locator('#kalkulacka').getByRole('radio', { name: 'Celý svět' })).toBeChecked();
});

test('world card "Spočítat poplatky" preselects "Celý svět" even before the calculator island has hydrated', async ({ page }) => {
  await setup(page);
  await hydrated(page, '#fondy');
  // the calculator (client:visible) has not hydrated yet: the click is what brings it into view
  await expect(page.locator('#kalkulacka astro-island')).toHaveAttribute('ssr', /.*/);
  await page.locator('#fondy').getByRole('link', { name: 'Spočítat poplatky v kalkulačce' }).click();
  await expect(page.locator('#kalkulacka astro-island')).not.toHaveAttribute('ssr', /.*/);
  await expect(page.locator('#kalkulacka').getByRole('radio', { name: 'Celý svět' })).toBeChecked();
  await expect(page.locator('#kalkulacka').getByTestId('calc-row').first()).toHaveAttribute('data-fund', 'SPYY');
});
