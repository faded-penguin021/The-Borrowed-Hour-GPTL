import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke suite. Runs against the Vite dev server (not `preview`): the service
 * worker registers only in PROD (see src/main.tsx), so dev guarantees nothing
 * intercepts the network and our `page.route()` mock of the LLM holds.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    // PW_CHROMIUM: path to a system Chromium for environments (e.g. agent
    // containers) whose preinstalled browser revision doesn't match this
    // Playwright version. Unset in CI, which installs the matching browser.
    launchOptions: process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM }
      : {},
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
