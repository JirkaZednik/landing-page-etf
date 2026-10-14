import { test, expect } from '@playwright/test';

test.skip(!process.env.BASE_URL, 'production smoke tests need BASE_URL (deployed site)');

test.describe('production smoke', () => {
  test('security headers are served', async ({ request }) => {
    const r = await request.get('/');
    expect(r.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(r.headers()['x-content-type-options']).toBe('nosniff');
    expect(r.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('no CSP violations with all consents accepted', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__csp = [];
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await page.goto('/?utm_content=a-4x5');
    await page.getByRole('button', { name: 'Přijmout' }).click();
    await page.waitForLoadState('networkidle');
    await page.reload(); // načtení analytiky se souhlasem
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
  });

  test('guide PDF is served', async ({ request }) => {
    const r = await request.get('/navod-etf.pdf');
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toContain('application/pdf');
  });

  test('thank-you page is noindex', async ({ page }) => {
    await page.goto('/dekujeme');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });


  test('API rejects invalid e-mail without touching Brevo', async ({ request, baseURL }) => {
    const r = await request.post('/api/subscribe', {
      headers: { origin: baseURL! }, data: { email: 'neni-email', aid: 'e2e', consent_marketing: '0' },
    });
    expect(await r.json()).toMatchObject({ ok: false, error: 'invalid_email' });
  });

  test('API honeypot returns silent success', async ({ request, baseURL }) => {
    const r = await request.post('/api/subscribe', {
      headers: { origin: baseURL! },
      data: { email: 'honeypot@example.com', aid: 'e2e', website: 'bot', consent_marketing: '0' },
    });
    expect(await r.json()).toMatchObject({ ok: true });
  });
});

// Review Focus 1: formulář bez JavaScriptu (nativní POST x-www-form-urlencoded → 303)
test.describe('production without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('hero form is a working native form above the fold', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const form = page.locator('form#form');
    await expect(form).toHaveAttribute('method', /post/i);
    await expect(form).toHaveAttribute('action', '/api/subscribe');
    const box = await form.getByRole('button', { name: 'Pošlete mi návod' }).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });

  test('form-encoded POST: honeypot → 303 /dekujeme?aid=…, invalid → 303 /?error=…#form', async ({ request, baseURL }) => {
    const post = (form: Record<string, string>) =>
      request.post('/api/subscribe', { headers: { origin: baseURL! }, form, maxRedirects: 0 });
    const ok = await post({ email: 'honeypot@example.com', website: 'bot', consent_marketing: '0' });
    expect(ok.status()).toBe(303);
    expect(ok.headers()['location']).toMatch(/\/dekujeme\?aid=[\w-]+/); // aid vygeneroval server
    const bad = await post({ email: 'neni-email', consent_marketing: '0' });
    expect(bad.status()).toBe(303);
    expect(bad.headers()['location']).toMatch(/\/\?error=[\w_]+#form$/);
  });
});
