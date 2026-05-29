// @ts-check

/**
 * @param {GameState | null | undefined} state
 * @returns {StatePromptBlocks}
 */
export function formatStateForPrompt(state) {
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
  const privateLines = [];
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

/**
 * @param {GameState | null | undefined} state
 * @returns {string}
 */
export function serializeStatePublic(state) {
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

/**
 * @param {string} content
 * @returns {string}
 */
export function stripHistoricalUser(content) {
  const m = content.match(/\[Player action\]\n([\s\S]*?)(?=\n\n\[GM-PRIVATE|$)/);
  if (!m)
    return content;
  return `[Player action]
${m[1].trim()}`;
}

/**
 * @param {string} content
 * @returns {string}
 */
export function stripHistoricalAssistant(content) {
  try {
    const obj = JSON.parse(content);
    const stripped = {
      narration: obj.narration
    };
    if (obj.ending)
      stripped.ending = obj.ending;
    return JSON.stringify(stripped);
  } catch {
    return content;
  }
}
