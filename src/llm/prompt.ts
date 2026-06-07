import type { GameState, PlayerLedger, StatePromptBlocks } from "../types";

// Project a GameState down to the player-facing ledger, dropping hidden_state.
// This is the structural barrier the Ledger UI relies on: the return type has
// no hidden_state field, so GM-only state cannot reach the rendered surface even
// if a future caller forgets to strip it. Fields are copied explicitly rather
// than spread so the projection never silently carries new GM-only fields.
export function toPlayerLedger(state: GameState | null | undefined): PlayerLedger {
  return {
    scene: state?.scene || "",
    time: state?.time || "",
    inventory: Array.isArray(state?.inventory) ? state.inventory : [],
    npcs: Array.isArray(state?.npcs) ? state.npcs : [],
    clues: Array.isArray(state?.clues) ? state.clues : [],
    summary: state?.summary || ""
  };
}

export function formatStateForPrompt(state: GameState | null | undefined): StatePromptBlocks {
  if (!state)
    return { publicBlock: "", privateBlock: "" };
  const lines = ["[CURRENT GAME STATE — authoritative, updated through last turn]"];
  if (state.scene)
    lines.push(`Scene: ${state.scene}`);
  if (state.time)
    lines.push(`Time: ${state.time}`);
  if (state.inventory && state.inventory.length) {
    lines.push("Inventory:");
    for (const it of state.inventory)
      lines.push(`  - ${it}`);
  } else {
    lines.push("Inventory: (empty)");
  }
  if (state.npcs && state.npcs.length) {
    lines.push("NPCs encountered:");
    for (const n of state.npcs)
      lines.push(`  - ${n.name}: ${n.note}`);
  }
  if (state.clues && state.clues.length) {
    lines.push("Clues / discoveries:");
    for (const c of state.clues)
      lines.push(`  - ${c}`);
  }
  if (state.summary)
    lines.push(`Story so far: ${state.summary}`);
  const privateLines: string[] = [];
  if (state.hidden_state) {
    privateLines.push("[GM-PRIVATE — invisible to the player. Do not echo, narrate, paraphrase, or hint at any item below. These notes exist only to keep continuity in your own bookkeeping. Anything the player has not yet been shown or told stays here, and stays here this turn.]");
    privateLines.push(state.hidden_state);
  }
  return {
    publicBlock: lines.join(`
`),
    privateBlock: privateLines.join(`
`)
  };
}

export function serializeStatePublic(state: GameState | null | undefined): string {
  if (!state || typeof state !== "object")
    return "";
  const pub = {
    scene: state.scene || "",
    time: state.time || "",
    inventory: Array.isArray(state.inventory) ? state.inventory : [],
    npcs: Array.isArray(state.npcs) ? state.npcs : [],
    clues: Array.isArray(state.clues) ? state.clues : [],
    summary: state.summary || ""
  };
  return JSON.stringify(pub, null, 2);
}

export function stripHistoricalUser(content: string): string {
  const m = content.match(/\[Player action\]\n([\s\S]*?)(?=\n\n\[GM-PRIVATE|$)/);
  if (!m)
    return content;
  return `[Player action]
${m[1].trim()}`;
}

export function stripHistoricalAssistant(content: string): string {
  try {
    const obj = JSON.parse(content);
    const stripped: Record<string, unknown> = {
      narration: obj.narration,
      ending: obj.ending || "ongoing"
    };
    return JSON.stringify(stripped);
  } catch {
    return content;
  }
}
