import type { GeneratedImage, ImageProviderId, ImageProviderMeta } from "../types";
// Image provider abstraction for the Prestige Codex. Parallel to providers.js
// (LLM providers) but kept separate because image APIs are fewer, simpler, and
// have different lifecycle (single shot, sometimes polled).
//
// All adapters share: { prompt, negatives[], signal } in, { url } out, where
// `url` is renderable directly in an <img> (a direct URL, a blob: URL, or a
// data: URL). Errors throw BorrowedError. Caller is responsible for catching
// — image failures never break a turn; they become a "Missing Plate".
import { BorrowedError, scrubSecrets } from "./errors";
import { isEncrypted } from "../storage/encryption";
import { getProviderKey } from "./providers";
import { decryptStored, KeysUnrecoverableError } from "../passphrase";
import { ReplicatePredictionSchema } from "./responseSchemas";

export const POLLINATIONS_DEFAULT_MODEL = "flux";
export const REPLICATE_DEFAULT_MODEL = "black-forest-labs/flux-schnell";
export const OPENAI_IMAGE_DEFAULT_MODEL = "gpt-image-2";
export const LOCAL_IMAGE_DEFAULT_URL = "http://localhost:7860/sdapi/v1/txt2img";

// gpt-image models OpenAI has retired or folded into gpt-image-2. Any of these
// is silently upgraded so a stale saved config never hits a dead model.
export const DEPRECATED_OPENAI_IMAGE_MODELS = ["gpt-image-1", "gpt-image-1-mini", "gpt-image-1.5", "chatgpt-image-latest"];

// Tunable parameters for the OpenAI images endpoint, shared by the adapter and
// the settings UI so the two can never drift. gpt-image-2 accepts flexible
// aspect ratios from 3:1 to 1:3; we surface a tasteful subset suited to
// manuscript plates. `label` is for the picker; `id` is the API `size` value.
export const OPENAI_IMAGE_SIZES: { id: string; label: string }[] = [
  { id: "1024x1024", label: "Square · 1024²" },
  { id: "1024x1536", label: "Portrait · 2:3" },
  { id: "1536x1024", label: "Landscape · 3:2" },
  { id: "1024x3072", label: "Tall plate · 1:3" },
  { id: "3072x1024", label: "Panorama · 3:1" },
  { id: "auto", label: "Auto" }
];
export const OPENAI_IMAGE_QUALITIES = ["low", "medium", "high", "auto"];
export const OPENAI_IMAGE_FORMATS = ["png", "webp", "jpeg"];

export const OPENAI_IMAGE_DEFAULT_SIZE = "1024x1024";
export const OPENAI_IMAGE_DEFAULT_QUALITY = "low";
export const OPENAI_IMAGE_DEFAULT_FORMAT = "png";

// checked: 2026-06-16. DALL-E 2/3 retired by OpenAI on 2026-05-12 — only
// gpt-image-* models remain for the OpenAI images endpoint.
export const IMAGE_PROVIDER_META: Record<ImageProviderId, ImageProviderMeta & { keyless?: boolean, reusesLLMProvider?: string, windowKey?: string, description?: string }> = {
  pollinations: {
    name: "Pollinations",
    keyless: true,
    description: "Free, keyless web router. No account needed.",
    defaultModel: POLLINATIONS_DEFAULT_MODEL,
    models: [
      { id: "flux", tier: "free" },
      { id: "zimage", tier: "free" },
      { id: "kontext", tier: "free" },
      { id: "nanobanana-pro", tier: "free" },
      { id: "seedream-pro", tier: "free" },
      { id: "gpt-image-2", tier: "free" }
    ]
  },
  replicate: {
    name: "Replicate",
    keyless: false,
    keyStorage: "borrowed:replicate_api_key:v1",
    windowKey: "REPLICATE_API_KEY",
    description: "Premium API with strong consistency. Bring your own key.",
    defaultModel: REPLICATE_DEFAULT_MODEL,
    models: [
      { id: "black-forest-labs/flux-schnell", tier: "fast" },
      { id: "black-forest-labs/flux-2-klein-4b", tier: "fast" },
      { id: "black-forest-labs/flux-2-pro", tier: "quality" }
    ]
  },
  openai: {
    name: "OpenAI Image",
    keyless: false,
    reusesLLMProvider: "openai",
    description: "Reuses your OpenAI API key (gpt-image family).",
    defaultModel: OPENAI_IMAGE_DEFAULT_MODEL,
    models: [
      { id: "gpt-image-2", tier: "flagship" }
    ]
  },
  local: {
    name: "Local",
    keyless: true,
    urlStorage: "borrowed:local_image_url:v1",
    description: "A1111 / ComfyUI / SD.Next style endpoint on your own machine.",
    defaultModel: "",
    models: []
  }
};

export const IMAGE_PROVIDER_ORDER = ["pollinations", "replicate", "openai", "local"];

const getReplicateKey = async (): Promise<string> => {
  const m = IMAGE_PROVIDER_META.replicate;
  // windowKey & keyStorage are defined on the `replicate` literal above.
  const windowKey = m.windowKey as string;
  const keyStorage = m.keyStorage as string;
  const injected = (window as unknown as Record<string, string>)[windowKey] || (document.querySelector(`meta[name="replicate-api-key"]`) as HTMLMetaElement | null)?.content;
  if (injected) return injected.trim();
  const stored = localStorage.getItem(keyStorage);
  if (!stored) throw new BorrowedError("The plate cannot be drawn.", "No Replicate API key is saved. Open Settings → Codex → Replicate to paste your key.");
  if (!isEncrypted(stored)) return stored.trim();
  let plain: string | null;
  try {
    plain = await decryptStored(keyStorage, stored);
  } catch (e) {
    if (e instanceof KeysUnrecoverableError)
      throw new BorrowedError("The plate cannot be drawn.", "Your stored keys can't be unlocked — the saved encryption salt is missing. Clear and re-enter the key in Settings.");
    throw new BorrowedError("The plate cannot be drawn.", "Could not unlock the Replicate API key — wrong passphrase.");
  }
  if (plain == null) throw new BorrowedError("The plate cannot be drawn.", "A session passphrase is required to unlock the Replicate key.");
  return plain;
};

export const getLocalImageUrl = (): string => {
  const urlStorage = IMAGE_PROVIDER_META.local.urlStorage as string;
  const stored = localStorage.getItem(urlStorage);
  return (stored && stored.trim()) || LOCAL_IMAGE_DEFAULT_URL;
};

// Compose "prompt --no negatives" or pass through as object — depends on
// provider. For Pollinations we pass a `negative_prompt` query param.
const joinNegatives = (negatives: string[] | undefined): string => Array.isArray(negatives) ? negatives.join(", ") : "";

// Fetch a remote image URL and convert it to a blob: URL. This works around
// CSP img-src restrictions and gives us an abortable, retryable lifecycle.
const blobify = async (url: string, signal?: AbortSignal): Promise<string> => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new BorrowedError("The plate cannot be drawn.", `Image fetch failed (HTTP ${res.status}).`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

interface ImageAdapterArgs {
  prompt: string;
  negatives?: string[];
  providerConfig?: Record<string, unknown>;
  signal?: AbortSignal;
}

// Minimal shapes for the untyped image-provider response JSON.
interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}
interface LocalImageResponse {
  images?: unknown[];
  image?: unknown;
}

// Pick a configured value only when it is a known-good option, else fall back.
// Guards the API against a stale or hand-edited config emitting an unknown
// `size`/`quality`/`output_format` that gpt-image would reject with a 400.
const pickOption = (value: unknown, allowed: readonly string[], fallback: string): string =>
  (typeof value === "string" && allowed.includes(value)) ? value : fallback;

const formatToMime = (fmt: string): string =>
  fmt === "jpeg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";

// Pure builder for the OpenAI images request body. Exported so it can be unit
// tested without a browser. Note what is deliberately ABSENT for gpt-image-2
// compliance: `input_fidelity` (removed — inputs are processed at high fidelity
// natively) and `background: "transparent"` (unsupported — would 400). The
// returned `mime` matches `output_format`, so the decoded data: URL is labelled
// correctly even when the format is webp/jpeg rather than png.
export const buildOpenAIImageBody = (
  prompt: string,
  providerConfig?: Record<string, unknown>
): { body: Record<string, unknown>; mime: string } => {
  let model = (providerConfig?.model as string | undefined) || OPENAI_IMAGE_DEFAULT_MODEL;
  if (DEPRECATED_OPENAI_IMAGE_MODELS.includes(model)) model = OPENAI_IMAGE_DEFAULT_MODEL;
  const size = pickOption(providerConfig?.size, OPENAI_IMAGE_SIZES.map((s) => s.id), OPENAI_IMAGE_DEFAULT_SIZE);
  const quality = pickOption(providerConfig?.quality, OPENAI_IMAGE_QUALITIES, OPENAI_IMAGE_DEFAULT_QUALITY);
  const outputFormat = pickOption(providerConfig?.output_format, OPENAI_IMAGE_FORMATS, OPENAI_IMAGE_DEFAULT_FORMAT);
  const body: Record<string, unknown> = { model, prompt, n: 1, size, quality, output_format: outputFormat };
  return { body, mime: formatToMime(outputFormat) };
};

const adapters: Record<ImageProviderId, (args: ImageAdapterArgs) => Promise<GeneratedImage>> = {
  async pollinations({ prompt, negatives, providerConfig, signal }) {
    const model = (providerConfig?.model as string | undefined) || POLLINATIONS_DEFAULT_MODEL;
    const seed = Math.floor(Math.random() * 1e9);
    const neg = joinNegatives(negatives);
    const params = new URLSearchParams({
      model, seed: String(seed), nologo: "true", enhance: "false", safe: "false", width: "1024", height: "1024"
    });
    if (neg) params.set("negative_prompt", neg);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
    // Pollinations responds with the image bytes directly from a GET. We
    // blobify so a failure surfaces as a thrown error (not a broken <img>).
    return { url: await blobify(url, signal), provider: "pollinations" };
  },

  async replicate({ prompt, negatives, providerConfig, signal }) {
    const apiKey = await getReplicateKey();
    const version = (providerConfig?.model as string | undefined) || REPLICATE_DEFAULT_MODEL;
    const body = {
      input: { prompt, negative_prompt: joinNegatives(negatives), num_outputs: 1, aspect_ratio: "1:1" }
    };
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Prefer: "wait=20"
    };
    // Use the model-specific endpoint that supports the `Prefer: wait` header,
    // which returns the prediction synchronously when it finishes quickly.
    const res = await fetch(`https://api.replicate.com/v1/models/${version}/predictions`, {
      method: "POST", headers, body: JSON.stringify(body), signal
    });
    if (!res.ok) {
      let snip = ""; try { snip = scrubSecrets((await res.text()).slice(0, 400)); } catch {}
      throw new BorrowedError("The plate cannot be drawn.", `Replicate rejected the request (HTTP ${res.status}). ${snip}`);
    }
    let pred = ReplicatePredictionSchema.parse(await res.json());
    // If still running, poll up to ~12s on top of the 20s prefer-wait.
    const started = Date.now();
    while (pred && (pred.status === "starting" || pred.status === "processing") && Date.now() - started < 12000) {
      await new Promise((r) => setTimeout(r, 1500));
      if (signal?.aborted) throw new BorrowedError("The hour is set down.", "Image cancelled.");
      // Only poll when the prediction actually handed us a status URL; a
      // running prediction with no `urls.get` is unrecoverable here.
      const pollUrl = pred.urls?.get;
      if (!pollUrl) throw new BorrowedError("The plate cannot be drawn.", `Replicate prediction is ${pred.status || "pending"} but returned no polling URL.`);
      const poll = await fetch(pollUrl, { headers: { Authorization: `Bearer ${apiKey}` }, signal });
      if (!poll.ok) break;
      pred = ReplicatePredictionSchema.parse(await poll.json());
    }
    if (pred.status !== "succeeded") {
      throw new BorrowedError("The plate cannot be drawn.", `Replicate prediction ended as ${pred.status || "unknown"}${pred.error ? `: ${pred.error}` : ""}.`);
    }
    const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (typeof out !== "string") throw new BorrowedError("The plate cannot be drawn.", "Replicate returned no image URL.");
    return { url: await blobify(out, signal), provider: "replicate" };
  },

  async openai({ prompt, providerConfig, signal }) {
    const apiKey = await getProviderKey("openai");
    const { body, mime } = buildOpenAIImageBody(prompt, providerConfig);
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal
    });
    if (!res.ok) {
      let snip = ""; try { snip = scrubSecrets((await res.text()).slice(0, 400)); } catch {}
      throw new BorrowedError("The plate cannot be drawn.", `OpenAI image API failed (HTTP ${res.status}). ${snip}`);
    }
    const data = await res.json() as OpenAIImageResponse;
    const item = data?.data?.[0];
    // gpt-image returns base64 by default; honour the requested output_format
    // in the data: URL so the bytes are labelled with the right MIME type.
    if (item?.b64_json) return { url: `data:${mime};base64,${item.b64_json}`, provider: "openai" };
    if (item?.url) return { url: await blobify(item.url, signal), provider: "openai" };
    throw new BorrowedError("The plate cannot be drawn.", "OpenAI image response had no payload.");
  },

  async local({ prompt, negatives, providerConfig, signal }) {
    const configUrl = providerConfig?.url as string | undefined;
    const url = (configUrl && configUrl.trim()) || getLocalImageUrl();
    const body = {
      prompt,
      negative_prompt: joinNegatives(negatives),
      steps: 22, width: 1024, height: 1024, cfg_scale: 5, sampler_name: "DPM++ 2M Karras"
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
    if (!res.ok) {
      let snip = ""; try { snip = (await res.text()).slice(0, 400); } catch {}
      throw new BorrowedError("The plate cannot be drawn.", `Local image endpoint failed (HTTP ${res.status}). ${snip}`);
    }
    const data = await res.json() as LocalImageResponse;
    // A1111 returns { images: [b64...] }. ComfyUI-style returns differ; we
    // accept either an images[] array of base64 or a single { image } field.
    const b64 = (Array.isArray(data?.images) && data.images[0]) || data?.image || null;
    if (typeof b64 !== "string") throw new BorrowedError("The plate cannot be drawn.", "Local endpoint returned no image bytes.");
    return { url: `data:image/png;base64,${b64}`, provider: "local" };
  }
};

export const generateImage = async ({ providerId, providerConfig, prompt, negatives, signal, timeoutMs = 20000 }: { providerId: ImageProviderId, providerConfig?: Record<string, unknown>, prompt: string, negatives?: string[], signal?: AbortSignal, timeoutMs?: number }): Promise<GeneratedImage> => {
  const adapter = adapters[providerId];
  if (!adapter) throw new BorrowedError("The plate cannot be drawn.", `Unknown image provider "${providerId}".`);
  const timeoutController = new AbortController();
  const onAbort = () => timeoutController.abort();
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  try {
    return await adapter({ prompt, negatives, providerConfig, signal: timeoutController.signal });
  } catch (e) {
    if (timeoutController.signal.aborted && !signal?.aborted) {
      throw new BorrowedError("The plate cannot be drawn.", `Image generation timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
};

export const setReplicateKey = (raw: string): void => {
  const keyStorage = IMAGE_PROVIDER_META.replicate.keyStorage as string;
  if (!raw) localStorage.removeItem(keyStorage);
  else localStorage.setItem(keyStorage, raw.trim());
};
export const getReplicateKeyPlaintext = (): string => {
  const v = localStorage.getItem(IMAGE_PROVIDER_META.replicate.keyStorage as string);
  if (!v || isEncrypted(v)) return "";
  return v;
};
export const setLocalImageUrl = (raw: string): void => {
  const urlStorage = IMAGE_PROVIDER_META.local.urlStorage as string;
  if (!raw) localStorage.removeItem(urlStorage);
  else localStorage.setItem(urlStorage, raw.trim());
};
