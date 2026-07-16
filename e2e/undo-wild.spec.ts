import { test, expect } from "./fixtures";

/**
 * Wild-mode start + undo round-trip. Reuses the mocked-LLM fixtures: a custom
 * (Wild) premise runs the same opening tool as a stock premise, so the canned
 * OPENING_RESULT / GM_TURN_RESULT / NARRATOR_PROSE apply. Asserts that advancing
 * a turn then undoing rolls the transcript AND the visible ledger state back to
 * the opening.
 */

test.describe("The Borrowed Hour — wild start + undo", () => {
  test("starts a Wild premise, advances a turn, and undoes it cleanly", async ({ page }) => {
    await page.goto("/");

    // Open the Wild ("The Unwritten Hour") flow and describe a scenario.
    await page.locator('button[data-realm="wild"]').click();
    const textarea = page.getByRole("textbox");
    await expect(textarea).toBeVisible();
    await textarea.fill(
      "A lighthouse keeper alone on a winter island, where the drowned have begun climbing the spiral stair.",
    );
    await page.getByRole("button", { name: /BEGIN THIS HOUR/ }).click();

    // Opening turn: exactly one narration entry, and nothing to undo yet.
    await expect(page.getByTestId("narration-entry")).toHaveCount(1);
    await expect(page.getByTestId("composer-input")).toBeVisible();
    const undo = page.getByRole("button", { name: "Undo the last turn" });
    await expect(undo).toBeDisabled();

    // Advance one turn.
    const composer = page.getByTestId("composer-input");
    await composer.fill("I climb toward the lantern room.");
    await composer.press("Enter");

    // The mocked GM turn + narrator prose append a second narration entry, and
    // the turn becomes undoable.
    await expect(page.getByTestId("narration-entry")).toHaveCount(2);
    await expect(page.getByText(/The door swings wide/)).toBeVisible();
    await expect(undo).toBeEnabled();

    // Undo the turn.
    await undo.click();

    // Transcript rolls back: the second narration is gone, one entry remains,
    // and the composer is still ready for play.
    await expect(page.getByTestId("narration-entry")).toHaveCount(1);
    await expect(page.getByText(/The door swings wide/)).toHaveCount(0);
    await expect(page.getByText("The last turn is unmade.")).toBeVisible();
    await expect(page.getByTestId("composer-input")).toBeVisible();

    // Visible ledger state rolls back to the opening scene, not the advanced one.
    await page.getByRole("button", { name: "Open the ledger" }).click();
    await expect(page.getByText("A lamplit corridor")).toBeVisible();
    await expect(page.getByText("A widening hall")).toHaveCount(0);
  });
});
