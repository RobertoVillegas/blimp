import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // README screenshots only run through `pnpm screenshots`.
  testIgnore: process.env.SCREENSHOTS ? [] : ['screenshots/**'],
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
});
