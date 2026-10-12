import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  output: 'static',
  adapter: vercel(),
  integrations: [react()],
  trailingSlash: 'never',
  // The dev toolbar sits on the bottom edge and intercepts clicks; Playwright turns it off.
  devToolbar: { enabled: process.env.ASTRO_DEV_TOOLBAR !== '0' },
});
