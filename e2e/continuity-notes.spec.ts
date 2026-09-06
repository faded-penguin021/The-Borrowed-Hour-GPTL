import { test, expect } from "./fixtures";

/**
 * The continuity findings surface (G5), end to end.
 *
 * The shared fixtures' canned turns are clean by construction, so this spec
 * installs its own LLM route: an opening that puts a person in the cast, then a
 * GM turn that silently drops them — the `npc-dropped` rule, chosen because it
 * is the one rule whose note names a concrete thing the player can check.
 *
 * What it proves is the half unit tests cannot: the finding survives the real
 * turn pipeline (parse → reduce → render) and reaches the modal, and it is
 * still folded away until the player clicks.
 */

const OPENING = {
  gm_scratchpad: "Establish the scene and the ferryman.",
  narration: "The lamplit corridor stretches ahead, and Bram waits at its end.",
  state: {
    ledger: {
      scene: "A lamplit corridor",
      time: "The appointed hour",
      inventory: [],
      npcs: [{ name: "Bram", note: "the ferryman" }],
      clues: [],
      summary: "You arrived and found Bram waiting.",
    },
    hidden_state: "Bram was paid to wait.",
  },
};

// Same turn, minus Bram: a person deleted rather than given a note.
const GM_TURN = {
  gm_scratchpad: "Advance the beat.",
  narrator_brief: "The player presses onward.",
  state: {
    ledger: {
      scene: "A widening hall",
      time: "Minutes later",
      inventory: [],
      npcs: [],
      clues: [],
      summary: "You pressed onward into the hall.",
    },
    hidden_state: "Bram was paid to wait.",
  },
};

const PROSE = "The door swings wide, and the borrowed hour draws its next breath.";

test.describe("The Borrowed Hour — continuity notes", () => {
  test("folds a finding into the ledger's margin until the player opens it", async ({ page }) => {
    // Registered after the fixture's route, so it wins.
    await page.route("https://api.openai.com/**", async (route) => {
      let toolName: string | undefined;
      try {
        toolName = route.request().postDataJSON()?.text?.format?.name;
      } catch {
        toolName = undefined;
      }
      const body =
        toolName === "narrate_and_update_state" ? JSON.stringify(OPENING)
        : toolName === "gm_decide" ? JSON.stringify(GM_TURN)
        : PROSE;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "completed", output_text: body }),
      });
    });

    await page.goto("/");
    await page.locator('button[data-realm="wild"]').click();
    const textarea = page.getByRole("textbox");
    await expect(textarea).toBeVisible();
    await textarea.fill("A ferryman waits at the end of a lamplit corridor.");
    await page.getByRole("button", { name: /BEGIN THIS HOUR/ }).click();
    await expect(page.getByTestId("narration-entry")).toHaveCount(1);

    // The opening turn is clean: nothing in the margin at all.
    await page.getByRole("button", { name: "Open the ledger" }).click();
    await expect(page.getByText("the ferryman")).toBeVisible();
    await expect(page.getByText(/left in the margin/)).toHaveCount(0);
    await page.getByRole("button", { name: "Close the ledger" }).click();

    // One turn later, Bram is gone from the cast.
    const composer = page.getByTestId("composer-input");
    await composer.fill("I go on without him.");
    await composer.press("Enter");
    await expect(page.getByTestId("narration-entry")).toHaveCount(2);

    await page.getByRole("button", { name: "Open the ledger" }).click();

    // The note exists but is not spent on a player who did not ask.
    const opener = page.getByRole("button", { name: /One note was left in the margin/ });
    await expect(opener).toBeVisible();
    await expect(page.getByText(/was listed here last turn/)).toHaveCount(0);

    await opener.click();
    await expect(page.getByText(/Bram was listed here last turn and is not listed now/)).toBeVisible();
  });
});
