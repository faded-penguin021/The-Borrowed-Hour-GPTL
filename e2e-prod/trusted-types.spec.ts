import { test, expect, cspViolations } from "./fixtures";

/**
 * Trusted Types enforcement, verified against the production build's real CSP.
 *
 * The suite proves four things: the directive ships, the browser actually
 * enforces it (a raw string at a script sink throws — the negative control),
 * the `puter-loader` policy the app relies on is allowlisted while other policy
 * names are rejected, and the real player flow renders clean with no violations.
 */

test.describe("Trusted Types (production CSP)", () => {
  test("ships require-trusted-types-for and the puter-loader allowlist", async ({ page }) => {
    await page.goto("/");
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp).toContain("trusted-types puter-loader");
  });

  test("blocks a raw string at a script-URL sink (enforcement is live)", async ({ page }) => {
    await page.goto("/");

    // A bare string assigned to HTMLScriptElement.src is the exact sink the Puter
    // loader uses; under enforcement the setter must throw before the script is
    // ever appended. If this does NOT throw, Trusted Types isn't really on.
    const threw = await page.evaluate(() => {
      try {
        const s = document.createElement("script");
        s.src = "https://js.puter.com/v2/";
        document.head.appendChild(s);
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toBe(true);

    const violations = await cspViolations(page);
    expect(violations.some((v) => /trusted-types/.test(v.directive))).toBe(true);
  });

  test("allows the puter-loader policy and yields a usable script URL", async ({ page }) => {
    await page.goto("/");

    // Mirrors src/security/trustedTypes.ts: the allowlisted policy turns the
    // Puter URL into a TrustedScriptURL that the src setter accepts.
    const src = await page.evaluate(() => {
      const policy = window.trustedTypes.createPolicy("puter-loader", {
        createScriptURL: (u: string) => u,
      });
      const url = policy.createScriptURL("https://js.puter.com/v2/");
      const s = document.createElement("script");
      s.src = url;
      return String(s.src);
    });
    expect(src).toContain("js.puter.com/v2/");
    expect(await cspViolations(page)).toEqual([]);
  });

  test("rejects a Trusted Types policy whose name is not allowlisted", async ({ page }) => {
    await page.goto("/");

    const threw = await page.evaluate(() => {
      try {
        window.trustedTypes.createPolicy("evil-policy", {
          createScriptURL: (u: string) => u,
        });
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toBe(true);

    const violations = await cspViolations(page);
    expect(violations.some((v) => /trusted-types/.test(v.directive))).toBe(true);
  });

  test("runs the opening turn with no CSP or Trusted Types violations", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("premise-card").first().click();
    await expect(page.getByTestId("narration-entry")).toHaveCount(1);

    const composer = page.getByTestId("composer-input");
    await composer.fill("I step forward into the corridor.");
    await composer.press("Enter");
    await expect(page.getByTestId("narration-entry")).toHaveCount(2);

    // Real React rendering + the game loop must not trip any CSP directive,
    // including Trusted Types. A failure here means the shipped build needs a
    // policy the allowlist doesn't grant.
    expect(await cspViolations(page)).toEqual([]);
  });
});
