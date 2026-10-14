import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  output: 'static',
  adapter: vercel(),
  integrations: [react()],
  trailingSlash: 'never',
  // Astro's built-in CSRF check rejected same-origin no-JS form POSTs on Vercel with 403
  // "Cross-site POST form submissions are forbidden" (tests/e2e/production.spec.ts). The API routes
  // do their own Origin/Referer check against SITE_URL (src/server/origin.ts), so turning it off
  // keeps cross-site protection.
  security: { checkOrigin: false },
  // The dev toolbar sits on the bottom edge and intercepts clicks; Playwright turns it off.
  devToolbar: { enabled: process.env.ASTRO_DEV_TOOLBAR !== '0' },
});
