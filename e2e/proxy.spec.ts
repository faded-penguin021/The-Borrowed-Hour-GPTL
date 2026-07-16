import { test, expect, fulfillLLM } from "./fixtures";

/**
 * BYOB proxy end-to-end: a regression net over F1/F2. With a proxy URL set in
 * Settings, both the Settings TEST button (checkProviderHealth) and an in-game
 * turn must route through `<proxy>?target=<encoded provider URL>` and never
 * contact the provider origin directly.
 *
 * The proxy origin (localhost) is inside the CSP connect-src allowlist, so this
 * exercises the real rewrite path. Both the proxy route and a recording route on
 * the provider origin fulfill via the shared canned-LLM helper.
 */

const PROXY_URL = "http://localhost:9999/llm";

test.describe("The Borrowed Hour — BYOB proxy", () => {
  test("routes both the Settings TEST and an in-game turn through the proxy", async ({ page }) => {
    const proxied: string[] = [];
    let directProviderHits = 0;

    // Requests that reach the proxy origin, recorded then fulfilled.
    await page.route("http://localhost:9999/**", async (route) => {
      proxied.push(route.request().url());
      await fulfillLLM(route);
    });
    // A recording route on the provider origin (registered after the fixture's,
    // so it wins): if the proxy rewrite is in effect this must never fire.
    await page.route("https://api.openai.com/**", async (route) => {
      directProviderHits += 1;
      await fulfillLLM(route);
    });

    await page.goto("/");

    // Set the proxy URL under the Proxy tab.
    await page.getByRole("button", { name: "Reader preferences" }).click();
    await page.getByRole("tab", { name: "Proxy" }).click();
    const proxyInput = page.getByLabel("Proxy URL");
    await proxyInput.fill(PROXY_URL);
    await proxyInput.blur();

    // TEST the OpenAI key under the System tab — the only provider with a seeded
    // key, so exactly one TEST button.
    await page.getByRole("tab", { name: "System" }).click();
    await page.getByRole("button", { name: "TEST" }).click();

    // Health check succeeds via the proxy, and the ping was rewritten to carry
    // the real provider URL as the ?target= param.
    await expect(page.getByText(/responded\.?$/)).toBeVisible();
    expect(proxied.some((u) => decodeURIComponent(u).includes("api.openai.com"))).toBe(true);
    const afterTest = proxied.length;

    // Close settings and play a turn.
    await page.getByRole("button", { name: "DONE" }).click();
    await page.getByTestId("premise-card").first().click();
    await expect(page.getByTestId("narration-entry")).toHaveCount(1);

    const composer = page.getByTestId("composer-input");
    await composer.fill("I step forward into the corridor.");
    await composer.press("Enter");
    await expect(page.getByTestId("narration-entry")).toHaveCount(2);

    // The opening + turn traffic also went through the proxy, and nothing hit
    // the provider origin directly.
    expect(proxied.length).toBeGreaterThan(afterTest);
    expect(directProviderHits).toBe(0);
  });
});
