import { defineConfig } from 'vitest/config';

// Build-output tests write public/navod-etf.pdf: run serially, outside `npm test`.
export default defineConfig({
  test: {
    include: ['tests/build/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    fileParallelism: false,
  },
});
