import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      'http://localhost:8787',
    trace: 'on-first-retry',
  },
  reporter: [['list']],
});
