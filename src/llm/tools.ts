export { buildSystem } from "../prompts/system";
export { buildNarratorSystem } from "../prompts/narrator";
export { buildMetaSystem } from "../prompts/meta";

// Tool definitions and shared schema fragments live in the neutral
// ./definitions module, which imports nothing from ./providers. Re-export them
// here for existing call sites that import from ./tools.
export {
  GM_SCRATCHPAD_DESC,
  STATE_SCHEMA,
  AMBIENCE_SCHEMA,
  GM_LOGIC_TOOL,
  GM_TOOL
} from "./definitions";
