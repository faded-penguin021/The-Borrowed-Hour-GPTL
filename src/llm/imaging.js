// Image provider abstraction for the Prestige Codex. Parallel to providers.js
// (LLM providers) but kept separate because image APIs are fewer, simpler, and
// have different lifecycle (single shot, sometimes polled).
//
// All adapters share: { prompt, negatives[], signal } in, { url } out, where
// `url` is renderable directly in an <img> (a direct URL, a blob: URL, or a
// data: URL). Errors throw BorrowedError. Caller is responsible for catching
// — image failures never break a turn; they become a "Missing Plate".
import { BorrowedError, scrubSecrets } from "./errors.js";
import { ENC_PREFIX, decryptSecret } from "../storage/encryption.js";
import { getProviderKey } from "./providers.js";

export const POLLINATIONS_DEFAULT_MODEL = "flux";
export const REPLICATE_DEFAULT_MODEL = "black-forest-labs/flux-schnell";
export const OPENAI_IMAGE_DEFAULT_MODEL = "gpt-image-1";
export const LOCAL_IMAGE_DEFAULT_URL = "http://localhost:7860/sdapi/v1/txt2img";

// checked: 2026-05-28
export const IMAGE_PROVIDER_META = {
  pollinations: {
    name: "Pollinations",
    keyless: true,
    description: "Free, keyless web router. No account needed.",
    defaultModel: POLLINATIONS_DEFAULT_MODEL,
    models: [
      { id: "flux", tier: "free" },
      { id: "flux-realism", tier: "free" },
      { id: "turbo", tier: "free" }
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
      { id: "black-forest-labs/flux-1.1-pro", tier: "quality" },
      { id: "stability-ai/sdxl", tier: "classic" }
    ]
  },
  openai: {
    name: "OpenAI Image",
    keyless: false,
    reusesLLMProvider: "openai",
    description: "Reuses your OpenAI API key (gpt-image-1).",
    defaultModel: OPENAI_IMAGE_DEFAULT_MODEL,
    models: [
      { id: "gpt-image-1", tier: "quality" },
      { id: "dall-e-3", tier: "standard" },
      { id: "dall-e-2", tier: "legacy" }
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

const getReplicateKey = async () => {
  const m = IMAGE_PROVIDER_META.replicate;
  const injected = window[m.windowKey] || document.querySelector(`meta[name="replicate-api-key"]`)?.content;
  if (injected) return injected.trim();
  const stored = localStorage.getItem(m.keyStorage);
  if (!stored) throw new BorrowedError("The plate cannot be drawn.", "No Replicate API key is saved. Open ⚙ Settings → Codex → Replicate to paste your key.");
  if (!stored.startsWith(ENC_PREFIX)) return stored.trim();
  if (!window.__sessionPassphrase) throw new BorrowedError("The plate cannot be drawn.", "Session passphrase missing for encrypted Replicate key.");
  try { return (await decryptSecret(stored, window.__sessionPassphrase)).trim(); }
  catch { throw new BorrowedError("The plate cannot be drawn.", "Could not unlock the Replicate API key."); }
};

export const getLocalImageUrl = () => {
  const stored = localStorage.getItem(IMAGE_PROVIDER_META.local.urlStorage);
  return (stored && stored.trim()) || LOCAL_IMAGE_DEFAULT_URL;
};

// Compose "prompt --no negatives" or pass through as object — depends on
// provider. For Pollinations we pass a `negative_prompt` query param.
const joinNegatives = (negatives) => Array.isArray(negatives) ? negatives.join(", ") : "";

// Fetch a remote image URL and convert it to a blob: URL. This works around
// CSP img-src restrictions and gives us an abortable, retryable lifecycle.
const blobify = async (url, signal) => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new BorrowedError("The plate cannot be drawn.", `Image fetch failed (HTTP ${res.status}).`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

const adapters = {
  async pollinations({ prompt, negatives, providerConfig, signal }) {
    const model = providerConfig?.model || POLLINATIONS_DEFAULT_MODEL;
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
    const version = providerConfig?.model || REPLICATE_DEFAULT_MODEL;
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
    let pred = await res.json();
    // If still running, poll up to ~12s on top of the 20s prefer-wait.
    const started = Date.now();
    while (pred && (pred.status === "starting" || pred.status === "processing") && Date.now() - started < 12000) {
      await new Promise((r) => setTimeout(r, 1500));
      if (signal?.aborted) throw new BorrowedError("The hour is set down.", "Image cancelled.");
      const poll = await fetch(pred.urls?.get, { headers: { Authorization: `Bearer ${apiKey}` }, signal });
      if (!poll.ok) break;
      pred = await poll.json();
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
    const model = providerConfig?.model || OPENAI_IMAGE_DEFAULT_MODEL;
    // Param shapes diverge by model family:
    //   gpt-image-1 (default): quality "low" pinned since "auto"/"high" can
    //     run >$0.05/image. Always returns b64_json; response_format rejected.
    //     Requires OpenAI organization verification on the key.
    //   dall-e-3: { quality: "standard"|"hd", response_format }. "standard"
    //     1024×1024 is ~$0.04/image; broadly available without org verification.
    //   dall-e-2: { response_format } only; cheapest legacy tier.
    const body = { model, prompt, n: 1, size: "1024x1024" };
    if (model.startsWith("gpt-image-1")) {
      body.quality = providerConfig?.quality || "low";
      body.output_format = providerConfig?.output_format || "png";
    } else if (model.startsWith("dall-e-3")) {
      body.quality = providerConfig?.quality || "standard";
      body.response_format = "b64_json";
    } else {
      body.response_format = "b64_json";
    }
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
    const data = await res.json();
    const item = data?.data?.[0];
    if (item?.b64_json) return { url: `data:image/png;base64,${item.b64_json}`, provider: "openai" };
    if (item?.url) return { url: await blobify(item.url, signal), provider: "openai" };
    throw new BorrowedError("The plate cannot be drawn.", "OpenAI image response had no payload.");
  },

  async local({ prompt, negatives, providerConfig, signal }) {
    const url = (providerConfig?.url && providerConfig.url.trim()) || getLocalImageUrl();
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
    const data = await res.json();
    // A1111 returns { images: [b64...] }. ComfyUI-style returns differ; we
    // accept either an images[] array of base64 or a single { image } field.
    const b64 = (Array.isArray(data?.images) && data.images[0]) || data?.image || null;
    if (typeof b64 !== "string") throw new BorrowedError("The plate cannot be drawn.", "Local endpoint returned no image bytes.");
    return { url: `data:image/png;base64,${b64}`, provider: "local" };
  }
};

// Top-level: dispatch by providerId with a hard timeout.
export const generateImage = async ({ providerId, providerConfig, prompt, negatives, signal, timeoutMs = 20000 }) => {
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

export const setReplicateKey = (raw) => {
  if (!raw) localStorage.removeItem(IMAGE_PROVIDER_META.replicate.keyStorage);
  else localStorage.setItem(IMAGE_PROVIDER_META.replicate.keyStorage, raw.trim());
};
export const getReplicateKeyPlaintext = () => {
  const v = localStorage.getItem(IMAGE_PROVIDER_META.replicate.keyStorage);
  if (!v || v.startsWith(ENC_PREFIX)) return "";
  return v;
};
export const setLocalImageUrl = (raw) => {
  if (!raw) localStorage.removeItem(IMAGE_PROVIDER_META.local.urlStorage);
  else localStorage.setItem(IMAGE_PROVIDER_META.local.urlStorage, raw.trim());
};
