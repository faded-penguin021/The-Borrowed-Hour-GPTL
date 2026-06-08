import { z } from "zod";

// Disable Zod v4's JIT validator. To decide whether it can compile validators
// with the Function constructor, Zod runs a one-time `new Function("")` probe
// wrapped in try/catch. The production CSP enforces require-trusted-types-for
// 'script', which blocks the Function constructor: Zod swallows the throw and
// falls back to interpreted validation (correct, just un-JITed), but the browser
// still fires a `securitypolicyviolation` for the caught attempt. `jitless` skips
// the probe — identical validation results, no spurious CSP-violation noise that
// would otherwise pollute real violation monitoring. Zod's own source documents
// this exact interaction (node_modules/zod/v4/core/util.js, `allowsEval`).
//
// Side-effecting module: import it before any code that builds or runs a schema.
z.config({ jitless: true });
