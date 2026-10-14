// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// The double opt-in page /potvrzeno never went live, so no old links exist and no redirect is kept.
it('vercel.json has no leftover /potvrzeno redirect', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  expect(cfg.redirects ?? []).toEqual([]);
});
