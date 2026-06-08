import { defineConfig, devices } from "@playwright/test";

/**
 * Production-CSP e2e. Unlike the smoke suite (playwright.config.ts), this builds
 * the app and serves it with `vite preview`, so the strict *shipped* CSP — including
 * `require-trusted-types-for 'script'` — is actually enforced. The dev server
 * relaxes that directive (vite.config.js), so Trusted Types can only be exercised
 * against the real build, and only in Chromium (the lone engine that implements it).
 *
 * Kept in its own testDir (`e2e-prod`) so the default suite never picks it up.
 * Run with `npm run test:e2e:prod`.
 */
export default defineConfig({
  testDir: "./e2e-prod",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
