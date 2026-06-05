import { test, expect } from "@playwright/test";

/**
 * Encrypted-key (enc:v2) passphrase flow. The default smoke fixture seeds a
 * *plaintext* key so the gate never opens; here we seed a real enc:v2 ciphertext
 * plus its per-install KDF salt, so starting a game must prompt for the
 * passphrase exactly once, then unlock and proceed.
 *
 * The v2 blob is produced in Node with the same primitives the app uses
 * (PBKDF2-SHA-256 310k → AES-GCM-256, salt = the persisted install salt), so the
 * key the app derives from the typed passphrase decrypts it.
 */

const ONBOARDING_KEY = "borrowed:onboarding:v1";
const OPENAI_KEY = "borrowed:openai_api_key:v1";
const SETTINGS_KEY = "borrowed:settings:v1";
const SALT_KEY = "borrowed:kdf-salt:v1";

const PASSPHRASE = "open-the-hour";
const REAL_KEY = "sk-test-borrowed-hour-encrypted";

const SEED_SETTINGS = {
  engineOpening: { provider: "openai", model: "gpt-4o-mini" },
  engineGM: { provider: "openai", model: "gpt-4o-mini" },
  engineNarrator: { provider: "openai", model: "gpt-4o-mini" },
  streamNarration: false,
  codex: { mode: "off" },
};

const OPENING_RESULT = {
  gm_scratchpad: "Establish the scene and the first beat.",
  narration: "The lamplit corridor stretches ahead, and the borrowed hour begins its quiet count.",
  state: {
    ledger: {
      scene: "A lamplit corridor",
      time: "The appointed hour",
      inventory: ["a folded letter"],
      npcs: [],
      clues: ["You were summoned here"],
      summary: "You arrived at the appointed hour and stepped into the corridor.",
    },
    hidden_state: "The corridor leads toward the reason you were called.",
  },
};

const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");

/** Build an enc:v2 blob + its salt the way src/storage/encryption.ts would. */
async function makeV2(plaintext: string, passphrase: string) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const km = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", iterations: 310000, salt },
    km, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)));
  return { blob: `enc:v2:${b64(iv)}.${b64(ct)}`, saltB64: b64(salt) };
}

test.describe("encrypted key — passphrase gate", () => {
  test("prompts once for the passphrase, then unlocks and starts a game", async ({ page }) => {
    const { blob, saltB64 } = await makeV2(REAL_KEY, PASSPHRASE);

    await page.addInitScript(
      ({ onboardingKey, openaiKey, settingsKey, saltKey, encryptedKey, salt, settings }) => {
        localStorage.setItem(onboardingKey, "1");
        localStorage.setItem(openaiKey, encryptedKey);
        localStorage.setItem(saltKey, salt);
        localStorage.setItem(settingsKey, JSON.stringify(settings));
      },
      {
        onboardingKey: ONBOARDING_KEY,
        openaiKey: OPENAI_KEY,
        settingsKey: SETTINGS_KEY,
        saltKey: SALT_KEY,
        encryptedKey: blob,
        salt: saltB64,
        settings: SEED_SETTINGS,
      },
    );

    // Assert the app sends the *decrypted* key to the provider.
    await page.route("https://api.openai.com/**", async (route) => {
      expect(route.request().headers()["authorization"]).toBe(`Bearer ${REAL_KEY}`);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "completed", output_text: JSON.stringify(OPENING_RESULT) }),
      });
    });

    await page.goto("/");
    await page.getByTestId("premise-card").first().click();

    // Resolving the key hits the encrypted branch → the passphrase modal opens.
    const field = page.getByLabel("Session passphrase");
    await expect(field).toBeVisible();
    await field.fill(PASSPHRASE);
    await page.getByRole("button", { name: "UNLOCK" }).click();

    // Unlocked: the game proceeds and the prompt does not reappear.
    await expect(page.getByTestId("narration-entry").first()).toBeVisible();
    await expect(page.getByLabel("Session passphrase")).toHaveCount(0);
  });
});
