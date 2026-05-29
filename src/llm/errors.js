// @ts-check

/**
 * @param {string} s
 * @returns {string}
 */
export var scrubSecrets = (s) => {
  if (typeof s !== "string")
    return s;
  return s.replace(/(sk-[A-Za-z0-9_-]{16,})|(AIza[A-Za-z0-9_-]{20,})/g, "[REDACTED]");
};

/**
 * @param {string | null | undefined} snippet
 * @returns {string}
 */
export var extractApiErrorMessage = (snippet) => {
  if (!snippet || typeof snippet !== "string")
    return "";
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
  /**
   * @param {string} message
   * @param {string | null} [detail]
   */
  constructor(message, detail) {
    super(message);
    this.name = "BorrowedError";
    /** @type {string | null} */
    this.detail = detail || null;
    /** @type {unknown} */
    this.raw = null;
  }
}

/**
 * @param {number} status
 * @param {string} [providerName]
 * @returns {string}
 */
export var httpStatusHint = (status, providerName = "the API") => {
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

/**
 * @param {unknown} e
 * @returns {{ message: string, detail: string | null, raw: unknown }}
 */
export var formatError = (e) => {
  if (e instanceof BorrowedError) {
    return { message: e.message, detail: e.detail, raw: e.raw || null };
  }
  if (e && typeof e === "object" && typeof (/** @type {any} */(e)).message === "string") {
    return { message: (/** @type {any} */(e)).message, detail: null, raw: (/** @type {any} */(e)).raw || null };
  }
  return { message: String(e), detail: null, raw: null };
};
