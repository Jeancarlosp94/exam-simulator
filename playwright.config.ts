import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Quizen E2E.
 *
 * The full auth-gated flow (upload → generate → play → grade) needs a live
 * Supabase + Anthropic, so it can't run on every PR. The smoke specs here
 * cover the static surfaces (landing, /login, /pricing) that DO work
 * without external services — that's enough to catch broken builds, busted
 * imports, and routing regressions early.
 *
 * To run locally:
 *   npx playwright install chromium    # one-time
 *   npm run dev                         # in another terminal
 *   npm run test:e2e
 *
 * In CI we don't install browsers — those specs are gated behind a manual
 * workflow_dispatch trigger (see .github/workflows/e2e.yml when added).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
