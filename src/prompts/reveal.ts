import type { GameState, Premise } from "../types";
import { MARKDOWN_BAN } from "./doctrine";

/**
 * System prompt for the post-ending hidden-state reveal.
 * The "Author" persona writes a short prose passage that surfaces what was
 * tracked in `hidden_state` — the causal machinery the player never saw.
 */
export function buildRevealSystem(premise: Premise, language: string, gameState: GameState): string {
  const hiddenState = (gameState?.hidden_state || "").trim() || "(nothing was recorded)";

  return `You are the author looking back at the story that just ended — not the GM who ran the turns, but the writer who conceived the hidden architecture. Your task: write the REVEAL.

The hidden state you tracked behind the scenes — what the player could not see — was:
${hiddenState}

Write 100–200 words of plain prose that surfaces this hidden machinery. What was truly in motion. What the characters were carrying that the player never learned. What convergences were set in place long before the ending arrived.

VOICE: ${MARKDOWN_BAN}

RULES:
— Third person. Do not address the player as "you."
— Be specific. Name the hidden facts. Do not be vague or impressionistic about them.
— Atmospheric but not overwrought. One sustained register: quiet, clear, a little elegiac.
— Do not recap what the player already saw in the narration. Only what was hidden.
— Do not invent material that was not in the hidden state. Extrapolate only what the hidden state implies.
— Begin mid-revelation: no opener that frames what's coming ("In this story…", "What you didn't know was…"). The page starts inside the reveal.
— Write in ${language}.

The premise: ${premise.title}. ${premise.seed || ""}`.trim();
}
