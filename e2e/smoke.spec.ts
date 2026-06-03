import { test, expect } from "./fixtures";

/**
 * Smoke suite: the critical player path with the LLM mocked. These assert the
 * app boots, gates behave, a game starts and advances, settings persist, and a
 * saved hour resumes — the journeys most likely to break silently on a refactor.
 */

test.describe("The Borrowed Hour — smoke", () => {
  test("boots to the title screen with premise cards, past onboarding", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".borrowed-root")).toBeVisible();

    // Premise cards only render on the title screen, which is gated behind the
    // OnboardingModal — so seeing four of them proves onboarding was skipped.
    const cards = page.getByTestId("premise-card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(4);

    // We are on the title screen, not in a game.
    await expect(page.getByTestId("composer-input")).toHaveCount(0);
  });

  test("passphrase gate stays closed with a plaintext key", async ({ page }) => {
    await page.goto("/");

    // Starting a game resolves the API key. With a plaintext (un-encrypted) key,
    // providers.ts returns it directly and the PassphraseModal must never appear.
    await page.getByTestId("premise-card").first().click();
    await expect(page.getByTestId("narration-entry").first()).toBeVisible();
    await expect(page.getByLabel("Session passphrase")).toHaveCount(0);
  });

  test("clicking a premise starts a game", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("premise-card").first().click();

    await expect(page.getByTestId("composer-input")).toBeVisible();
    await expect(page.getByTestId("narration-entry").first()).toBeVisible();
  });

  test("submitting an action renders a new narration entry", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("premise-card").first().click();

    // The opening turn renders exactly one narration entry.
    await expect(page.getByTestId("narration-entry")).toHaveCount(1);

    const composer = page.getByTestId("composer-input");
    await composer.fill("I step forward into the corridor.");
    await composer.press("Enter");

    // The mocked GM turn + narrator prose append a second narration entry.
    await expect(page.getByTestId("narration-entry")).toHaveCount(2);
  });

  test("settings: toggling high contrast persists", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Reader preferences" }).click();

    const toggle = page.locator("#setting-high-contrast");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    const persisted = await page.evaluate(() => {
      const raw = localStorage.getItem("borrowed:settings:v1");
      return raw ? JSON.parse(raw).highContrast : null;
    });
    expect(persisted).toBe(true);
  });

  test("save then reload then resume restores the narration", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("premise-card").first().click();
    await expect(page.getByTestId("narration-entry").first()).toBeVisible();

    await page.getByRole("button", { name: "Set aside this hour" }).click();
    // Saves persist to the IndexedDB `saves` store (borrowed-images DB), not
    // localStorage — wait until the record lands there before reloading.
    await page.waitForFunction(() =>
      new Promise<boolean>((resolve) => {
        let req: IDBOpenDBRequest;
        try {
          req = indexedDB.open("borrowed-images");
        } catch {
          resolve(false);
          return;
        }
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("saves")) {
            resolve(false);
            return;
          }
          const keysReq = db.transaction("saves", "readonly").objectStore("saves").getAllKeys();
          keysReq.onsuccess = () =>
            resolve(keysReq.result.some((k) => String(k).startsWith("borrowed:save:")));
          keysReq.onerror = () => resolve(false);
        };
        req.onerror = () => resolve(false);
      }),
    );

    await page.reload();

    await page.getByRole("button", { name: /RESUME AN HOUR/ }).click();
    await page.getByTestId("save-row").first().click();

    await expect(page.getByTestId("narration-entry").first()).toBeVisible();
    await expect(page.getByTestId("composer-input")).toBeVisible();
  });
});
