import { test as base, expect, type Route } from "@playwright/test";

/**
 * Deterministic test harness for the smoke suite.
 *
 * Every test runs against a seeded localStorage and a single mocked LLM
 * endpoint, both installed before the app's scripts run:
 *
 *  - `addInitScript` seeds onboarding (skips OnboardingModal), a *plaintext*
 *    OpenAI key (so providers.ts returns it directly and PassphraseModal never
 *    fires), and settings pinning all three engine roles to openai/gpt-4o-mini
 *    with streaming + illustrations off.
 *  - `page.route` intercepts the OpenAI Responses API at the browser layer
 *    (before the strict production `connect-src` CSP applies) and returns canned
 *    JSON keyed on the requested tool name (`text.format.name`).
 */

/** A key with no `enc:v1:` prefix → providers.ts returns it without a passphrase. */
export const PLAINTEXT_KEY = "sk-test-borrowed-hour-playwright";

/** Storage keys (mirror src/data/constants.ts and the openai provider config). */
const ONBOARDING_KEY = "borrowed:onboarding:v1";
const OPENAI_KEY = "borrowed:openai_api_key:v1";
const SETTINGS_KEY = "borrowed:settings:v1";

/** Overrides merged onto DEFAULT_SETTINGS by useSettings(). */
const SEED_SETTINGS = {
  engineOpening: { provider: "openai", model: "gpt-4o-mini" },
  engineGM: { provider: "openai", model: "gpt-4o-mini" },
  engineNarrator: { provider: "openai", model: "gpt-4o-mini" },
  streamNarration: false,
  codex: { mode: "off" },
};

/** Opening turn — `narrate_and_update_state` (narration + full state ledger). */
const OPENING_RESULT = {
  gm_scratchpad: "Establish the scene and the first beat.",
  narration:
    "The lamplit corridor stretches ahead, and the borrowed hour begins its quiet count.",
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

/** Per-turn GM logic — `gm_decide` (narrator brief + updated state). */
const GM_TURN_RESULT = {
  gm_scratchpad: "Advance the beat; open a way forward.",
  narrator_brief: "The player presses onward; a door gives way.",
  state: {
    ledger: {
      scene: "A widening hall",
      time: "Minutes later",
      inventory: ["a folded letter"],
      npcs: [],
      clues: ["You were summoned here", "A door has opened"],
      summary: "You pressed onward into the hall and found a door swinging wide.",
    },
    hidden_state: "Beyond the door waits the reason for the summons.",
  },
};

/** Plain narrator prose — the non-tool call that renders the next narration. */
const NARRATOR_PROSE =
  "The door swings wide, and beyond it the borrowed hour draws its next breath. You step through, the letter warm against your palm.";

/** The canned `output_text` for a given tool name (undefined → narrator prose). */
export function outputTextForTool(toolName?: string): string {
  if (toolName === "narrate_and_update_state") return JSON.stringify(OPENING_RESULT);
  if (toolName === "gm_decide") return JSON.stringify(GM_TURN_RESULT);
  return NARRATOR_PROSE;
}

/**
 * Fulfill an intercepted LLM request with the canned response keyed on the
 * requested tool name. Shared by the direct-provider route below and by the
 * BYOB-proxy route in the proxy spec, so both paths return identical turns.
 */
export async function fulfillLLM(route: Route): Promise<void> {
  let toolName: string | undefined;
  try {
    toolName = route.request().postDataJSON()?.text?.format?.name;
  } catch {
    toolName = undefined;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ status: "completed", output_text: outputTextForTool(toolName) }),
  });
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(
      ({ onboardingKey, openaiKey, settingsKey, key, settings }) => {
        localStorage.setItem(onboardingKey, "1");
        localStorage.setItem(openaiKey, key);
        localStorage.setItem(settingsKey, JSON.stringify(settings));
      },
      {
        onboardingKey: ONBOARDING_KEY,
        openaiKey: OPENAI_KEY,
        settingsKey: SETTINGS_KEY,
        key: PLAINTEXT_KEY,
        settings: SEED_SETTINGS,
      },
    );

    await page.route("https://api.openai.com/**", fulfillLLM);

    await use(page);
  },
});

export { expect };
