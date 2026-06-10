// Dependency-free model-catalogue drift detector.
//
// Cross-checks the committed provider catalogue in src/llm/providers.ts against
// OpenRouter's PUBLIC model listing (no API key) and reports:
//   1. dead ids   — models your `openrouter` entry lists that OpenRouter no
//                   longer serves (these 404 at runtime). Exact check.
//   2. candidates — models OpenRouter now lists for vendors you support but you
//                   don't reference yet, flagged free/paid. HINTS, not drop-ins:
//                   a provider's native id may differ from OpenRouter's slug.
//   3. staleness  — age of the `// checked:` date in providers.ts.
//
// This is maintenance tooling — it never runs in the browser bundle. Run by
// hand or let the scheduled catalogue-refresh session drive it:
//   npm run check:models            (free candidates only)
//   npm run check:models -- --all   (include paid candidates)
//   npm run check:models -- --json  (machine-readable, for the agent)
// Exit codes: 0 clean · 1 dead ids found · 2 couldn't reach OpenRouter.
// Procedure for curating + opening the PR: docs/model-catalogue-maintenance.md
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROVIDERS_TS = join(HERE, "..", "src", "llm", "providers.ts");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";

const args = new Set(process.argv.slice(2));
const AS_JSON = args.has("--json");
const INCLUDE_PAID = args.has("--all");

// Native provider -> OpenRouter vendor prefix that serves the same models.
//   "*"  — ids ARE OpenRouter slugs (the `openrouter` entry): exact liveness check.
//   null — OpenRouter doesn't aggregate it; the scheduled session covers these
//          by web search instead (see docs/model-catalogue-maintenance.md).
const OPENROUTER_VENDOR = {
  openrouter: "*",
  anthropic: "anthropic",
  openai: "openai",
  gemini: "google",
  deepseek: "deepseek",
  qwen: "qwen",
  mistral: "mistralai",
  kimi: "moonshotai",
  groq: null,
  ernie: null,
  cerebras: null,
  local: null
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Parse the catalogue straight from source text — no TS execution, no module
// graph, no side effects. Fails loudly if the shape drifts so it can never
// silently miss a provider's models.
function readCatalogue() {
  const src = readFileSync(PROVIDERS_TS, "utf8");

  const metaStart = src.indexOf("export const PROVIDER_META");
  const metaEnd = src.indexOf("export const PROVIDER_ORDER");
  if (metaStart < 0 || metaEnd < 0)
    throw new Error("could not locate PROVIDER_META in providers.ts");
  const metaSrc = src.slice(metaStart, metaEnd);

  const orderMatch = src.match(/PROVIDER_ORDER:\s*ProviderId\[\]\s*=\s*\[([\s\S]*?)\]/);
  if (!orderMatch) throw new Error("could not parse PROVIDER_ORDER");
  const order = [...orderMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (order.length === 0) throw new Error("PROVIDER_ORDER parsed empty");

  const models = {};
  for (const id of order) {
    const at = metaSrc.search(new RegExp(`\\n\\s*${escapeRegExp(id)}:\\s*\\{`));
    if (at < 0) throw new Error(`provider "${id}" missing from PROVIDER_META`);
    const modelsKey = metaSrc.indexOf("models:", at);
    const open = metaSrc.indexOf("[", modelsKey);
    const close = metaSrc.indexOf("]", open);
    if (modelsKey < 0 || open < 0 || close < 0)
      throw new Error(`could not parse models[] for "${id}"`);
    const block = metaSrc.slice(open, close);
    const list = [
      ...block.matchAll(/\{\s*id:\s*"([^"]+)"(?:\s*,\s*tier:\s*"([^"]+)")?\s*\}/g)
    ].map((m) => ({ id: m[1], tier: m[2] || null }));
    if (list.length === 0)
      throw new Error(`no models parsed for "${id}" — has the format changed?`);
    models[id] = list;
  }

  const checked = src.match(/\/\/\s*checked:\s*(\d{4}-\d{2}-\d{2})/);
  return { order, models, checked: checked ? checked[1] : null };
}

function daysSince(iso) {
  if (!iso) return null;
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

// Staleness across all three hand-maintained catalogues. The OpenRouter diff
// below only covers the LLM catalogue (OpenRouter doesn't list image/TTS
// models), so for image + TTS this age is the only signal here — refresh those
// via the provider endpoints named in docs/model-catalogue-maintenance.md.
const CATALOGUE_FILES = [
  { label: "LLM", path: "src/llm/providers.ts" },
  { label: "Image", path: "src/llm/imaging.ts" },
  { label: "TTS", path: "src/tts/catalogue.ts" }
];
function readCheckedDates() {
  return CATALOGUE_FILES.map(({ label, path }) => {
    let date = null;
    try {
      const m = readFileSync(join(HERE, "..", path), "utf8").match(
        /\/\/\s*checked:\s*(\d{4}-\d{2}-\d{2})/
      );
      date = m ? m[1] : null;
    } catch {
      // file missing — leave date null
    }
    return { label, path, date, ageDays: date != null ? daysSince(date) : null };
  });
}

async function fetchOpenRouter() {
  const res = await fetch(OPENROUTER_URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`OpenRouter responded ${res.status}`);
  const json = await res.json();
  if (!json || !Array.isArray(json.data)) throw new Error("unexpected OpenRouter payload");
  return json.data;
}

const isFree = (m) =>
  String(m.id).endsWith(":free") ||
  (m.pricing && m.pricing.prompt === "0" && m.pricing.completion === "0");

// OpenRouter normalizes ids into its own slug convention, which differs from a
// provider's native id: a vendor/ prefix, dot-vs-hyphen versions (sonnet-4.5 vs
// sonnet-4-6), dropped date suffixes, and :variant routing tags. Fold all that
// away so candidate de-duping recognizes the same model across both namings and
// doesn't surface a punctuation variant of something you already track. Genuine
// version differences (4-5 vs 4-6) still stay distinct — only punctuation,
// prefix, dates, and routing tags collapse. This only suppresses noise; it never
// makes an OpenRouter slug authoritative — the native id is still confirmed by hand.
const normalizeId = (id) =>
  String(id)
    .toLowerCase()
    .replace(/:[a-z0-9]+$/, "")           // :free, :nitro, :thinking …
    .replace(/^[^/]+\//, "")              // drop the vendor/ prefix
    .replace(/-\d{4}-\d{2}-\d{2}$/, "")    // drop a YYYY-MM-DD date suffix
    .replace(/-?\d{8}$/, "")               // drop a YYYYMMDD date suffix
    .replace(/[-_.\s]/g, "");             // collapse separators (dot === hyphen)

function analyse(catalogue, orModels) {
  const orIds = new Set(orModels.map((m) => m.id));
  const orFree = new Map(orModels.map((m) => [m.id, isFree(m)]));

  // Every id referenced anywhere, normalized, for de-duping candidates across
  // the native <-> OpenRouter naming gap.
  const referencedNorm = new Set();
  for (const list of Object.values(catalogue.models))
    for (const m of list) referencedNorm.add(normalizeId(m.id));

  // 1. Dead ids — exact, only meaningful for `openrouter` (ids are OR slugs).
  const dead = (catalogue.models.openrouter || [])
    .map((m) => m.id)
    .filter((id) => !orIds.has(id));

  // 2. Candidates per native vendor.
  const candidates = {};
  const unverifiable = [];
  for (const [provider, vendor] of Object.entries(OPENROUTER_VENDOR)) {
    if (vendor === "*") continue; // covered by the dead-id check
    if (vendor === null) {
      unverifiable.push(provider);
      continue;
    }
    const prefix = `${vendor}/`;
    const found = [];
    for (const m of orModels) {
      const orId = String(m.id);
      if (!orId.startsWith(prefix)) continue;
      const bare = orId.slice(prefix.length).replace(/:[a-z0-9]+$/, "");
      // Compare on the normalized form so e.g. anthropic/claude-sonnet-4.5
      // dedupes against a native claude-sonnet-4-5 you already list.
      if (referencedNorm.has(normalizeId(orId))) continue;
      const free = !!orFree.get(m.id);
      if (!free && !INCLUDE_PAID) continue;
      found.push({ id: orId, bare, free });
    }
    found.sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id));
    if (found.length) candidates[provider] = found.slice(0, 8);
  }

  return { dead, candidates, unverifiable };
}

function report(catalogues, orModels, fetchError, result) {
  const out = [];
  out.push("Borrowed Hour — model catalogue drift check");
  out.push("Catalogues:");
  for (const c of catalogues) {
    const stamp =
      c.date == null
        ? "no `checked:` date"
        : `checked ${c.date}` +
          (c.ageDays != null ? ` (${c.ageDays} day${c.ageDays === 1 ? "" : "s"} ago)` : "");
    out.push(`  ${c.label.padEnd(6)} ${c.path.padEnd(22)} ${stamp}`);
  }

  if (fetchError) {
    out.push("");
    out.push(`OpenRouter: could not reach catalog — ${fetchError}`);
    out.push("  (offline or blocked by the network policy; rerun where openrouter.ai is reachable)");
    console.log(out.join("\n"));
    return;
  }

  out.push("");
  out.push(`OpenRouter: ${orModels.length} models (public catalog, no key) — cross-checks the LLM catalogue only`);
  out.push("");
  out.push(
    result.dead.length
      ? "DEAD ids in your `openrouter` entry (these 404 at runtime):"
      : "DEAD ids in your `openrouter` entry: none — all live"
  );
  for (const id of result.dead) out.push(`  x ${id}`);

  out.push("");
  const vendors = Object.keys(result.candidates);
  const scope = INCLUDE_PAID ? "" : "free ";
  out.push(
    vendors.length
      ? `NEW ${scope}candidates OpenRouter lists that you don't reference:`
      : `NEW ${scope}candidates: none`
  );
  out.push("  (hints, not drop-ins — a provider's native id may differ from the OpenRouter slug)");
  for (const v of vendors) {
    out.push(`  ${v}:`);
    for (const c of result.candidates[v]) out.push(`    + ${c.id}${c.free ? "  (free)" : ""}`);
  }
  if (!INCLUDE_PAID) out.push("  ...rerun with --all to include paid candidates");

  if (result.unverifiable.length) {
    out.push("");
    out.push(`NOT on OpenRouter — confirm via web search: ${result.unverifiable.join(", ")}`);
  }

  out.push("");
  out.push("Image + TTS aren't on OpenRouter — refresh those via provider endpoints (see docs).");
  out.push("Curate + open a PR: docs/model-catalogue-maintenance.md");
  console.log(out.join("\n"));
}

async function main() {
  const catalogue = readCatalogue();
  const catalogues = readCheckedDates();

  let orModels = null;
  let fetchError = null;
  try {
    orModels = await fetchOpenRouter();
  } catch (e) {
    fetchError = e?.message || String(e);
  }

  const result = orModels ? analyse(catalogue, orModels) : null;

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          catalogues,
          llm: { providers: catalogue.order.length },
          openrouter: orModels ? { count: orModels.length } : { error: fetchError },
          ...(result || {})
        },
        null,
        2
      )
    );
  } else {
    report(catalogues, orModels, fetchError, result);
  }

  if (fetchError) process.exit(2);
  if (result.dead.length) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(2);
});
