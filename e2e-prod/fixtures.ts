import { test as base, expect } from "../e2e/fixtures";
import type { Page } from "@playwright/test";

/**
 * Production-preview fixture. Reuses the smoke fixture (seeded localStorage +
 * mocked LLM route) and adds two things needed against the real build:
 *
 *  - disables the service worker, which registers only in PROD and would
 *    otherwise sit between the page and the mocked LLM route under `vite preview`;
 *  - installs a `securitypolicyviolation` collector before any app script runs,
 *    so tests can assert whether Trusted Types (or any CSP directive) fired.
 */

declare global {
  interface Window {
    __cspViolations?: { directive: string; sample: string; blockedURI: string }[];
  }
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.register = () =>
            Promise.reject(new Error("service worker disabled for test"));
        }
      } catch {
        /* best effort — registration may be non-writable */
      }
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        window.__cspViolations!.push({
          directive: e.effectiveDirective || e.violatedDirective,
          sample: e.sample || "",
          blockedURI: e.blockedURI || "",
        });
      });
    });
    await use(page);
  },
});

export { expect };

/** Snapshot of CSP violations recorded in the page so far. */
export function cspViolations(page: Page) {
  return page.evaluate(() => window.__cspViolations ?? []);
}
