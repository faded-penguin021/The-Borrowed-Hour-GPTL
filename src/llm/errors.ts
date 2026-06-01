/**
 * Redact secrets from a string before it reaches a log or the UI.
 *
 * The pattern pass is only a backstop for common key shapes (`sk-…`,
 * `AIza…`). It does NOT know every provider's key format, so when the caller
 * holds the actual secret it should pass it as `literalSecret` — that gets a
 * verbatim replacement, which covers any provider regardless of shape.
 *
 * @param literalSecret the exact key used for this request
 */
export const scrubSecrets = (s: string, literalSecret?: string | null): string => {
  if (typeof s !== "string") return s;
  let out = s;
  if (typeof literalSecret === "string" && literalSecret.length >= 8) {
    out = out.split(literalSecret).join("[REDACTED]");
  }
  return out.replace(/(sk-[A-Za-z0-9_-]{16,})|(AIza[A-Za-z0-9_-]{20,})/g, "[REDACTED]");
};

export const extractApiErrorMessage = (snippet: string | null | undefined): string => {
  if (!snippet || typeof snippet !== "string") return "";
  try {
    const parsed = JSON.parse(snippet);
    const err = parsed?.error;
    if (typeof err === "string" && err.trim()) return err.trim();
    if (err && typeof err === "object") {
      if (typeof err.message === "string" && err.message.trim()) return err.message.trim();
      if (typeof err.msg === "string" && err.msg.trim()) return err.msg.trim();
    }
    if (typeof parsed?.message === "string" && parsed.message.trim()) return parsed.message.trim();
    if (typeof parsed?.detail === "string" && parsed.detail.trim()) return parsed.detail.trim();
  } catch {}
  return snippet.trim();
};

export class BorrowedError extends Error {
  detail: string | null;
  raw: unknown;

  constructor(message: string, detail?: string | null) {
    super(message);
    this.name = "BorrowedError";
    this.detail = detail || null;
    this.raw = null;
  }
}

export const httpStatusHint = (status: number, providerName = "the API"): string => {
  switch (status) {
    case 400:
      return "API rejected the request (HTTP 400 — likely a malformed prompt or schema).";
    case 401:
      return `API authentication failed (HTTP 401 — check your ${providerName} API key).`;
    case 403:
      return "API forbade the request (HTTP 403 — key may lack access to this model).";
    case 404:
      return "API endpoint or model not found (HTTP 404 — model ID may be deprecated).";
    case 408:
      return "Request timed out before the API responded (HTTP 408).";
    case 413:
      return "Request body too large (HTTP 413 — chronicle history exceeded the limit).";
    case 429:
      return "Rate-limited by the API (HTTP 429 — too many requests, or out of credits).";
    case 500:
      return "API hit an internal error (HTTP 500 — usually transient).";
    case 502:
    case 503:
    case 504:
      return `${providerName} gateway error (HTTP ${status} — usually transient).`;
    case 529:
      return `${providerName} model overloaded (HTTP 529 — try again in a moment).`;
    default:
      return `Unexpected API status (HTTP ${status}).`;
  }
};

export const formatError = (
  e: unknown
): { message: string; detail: string | null; raw: unknown } => {
  if (e instanceof BorrowedError) {
    return { message: e.message, detail: e.detail, raw: e.raw || null };
  }
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    const obj = e as { message: string; raw?: unknown };
    return { message: obj.message, detail: null, raw: obj.raw ?? null };
  }
  return { message: String(e), detail: null, raw: null };
};
