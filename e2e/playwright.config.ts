import { defineConfig } from '@playwright/test';

// `*.e2e.ts` suffix keeps these specs out of the repo's `bun test` discovery.
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  // Sequential, single browser session — no parallel windows / tab flicker.
  fullyParallel: false,
  workers: process.env.PLAYWRIGHT_WORKERS ?? 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    // runs headless by default; use HEADED=1 to run headed.
    headless: !process.env.HEADED,
    // Staging's `load` event can be slow; absorb spikes without failing.
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // `retain-on-failure` records for the whole run and finalizes on every
    // context.close(); with two long-lived contexts that races Playwright's
    // network-trace copy (ENOENT on `*-pwnetcopy-*.network`) and fails green
    // tests. `on-first-retry` only traces the retry (CI has retries: 2).
    // Local debugging: `bun playwright test --trace on <file>`.
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
});
