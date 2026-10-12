// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { imageSizeFromFile } from 'image-size/fromFile';

// Renders with Chromium and rewrites the committed PNGs: runs only via `npm run test:build`.
const OUTPUTS = {
  'ads/a-4x5.png': [1080, 1350],
  'ads/a-9x16.png': [1080, 1920],
  'ads/b-4x5.png': [1080, 1350],
  'ads/b-9x16.png': [1080, 1920],
  'public/og.png': [1200, 630], // Base.astro default og:image
} as const;

describe('render-ads', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'ads'], { stdio: 'inherit' });
  }, 180_000);

  for (const [file, [w, h]] of Object.entries(OUTPUTS))
    it(`${file} is ${w}x${h}`, async () => {
      const d = await imageSizeFromFile(file);
      expect([d.width, d.height]).toEqual([w, h]);
    });
});
