// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// Old e-mail links and bookmarks to the removed /potvrzeno page (double opt-in, v2).
// Vercel keeps the incoming query string, so ?aid= survives; checked live by tests/e2e/production.spec.ts.
it('vercel.json redirects /potvrzeno → /dekujeme with 301', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  expect(cfg.redirects).toContainEqual({ source: '/potvrzeno', destination: '/dekujeme', statusCode: 301 });
});
