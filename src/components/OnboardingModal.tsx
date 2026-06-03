import React, { useState } from "react";
import { encryptSecret } from "../storage/encryption";
import { ONBOARDING_KEY } from "../data/constants";
import { PROVIDER_META } from "../llm/providers";
import { usePassphrase } from "../context/PassphraseContext";
import { Modal } from "./ui/Modal";
import { IconButton } from "./ui/IconButton";
import { FIELD_SETTINGS } from "./ui/styleClasses";
import { Sparkles, ArrowRight } from "lucide-react";

/** The provider offered during onboarding — the default free engine. */
const ONBOARD_PROVIDER = "mistral";

/**
 * First-run welcome flow. Rendered by `App` *in place of* the `GameProvider`
 * tree until the user dismisses it, so the global `PassphraseModal` can't race
 * the onboarding for the same first paint.
 *
 * Three slides: a welcome, an explanation of the bring-your-own-key model, and
 * a setup step where the reader picks a session passphrase and (optionally)
 * pastes a first key. The key is encrypted with `encryptSecret` — the same
 * primitive the settings rows use — and the chosen passphrase is held in
 * React-owned memory (via the passphrase context, not on `window`) so nothing
 * has to be re-entered this session.
 */
interface OnboardingModalProps {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { setSessionPassphrase } = usePassphrase();
  const [slide, setSlide] = useState(0);
  const [passphrase, setPassphrase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = PROVIDER_META[ONBOARD_PROVIDER];

  /** Persist the onboarding flag, stash the passphrase, encrypt any key, leave. */
  const finish = async () => {
    setError(null);
    const pass = passphrase.trim();
    const key = apiKey.trim();
    if (key && !pass) {
      setError("Choose a passphrase first — it's the lock for your key.");
      return;
    }
    setSaving(true);
    try {
      if (pass) setSessionPassphrase(pass);
      if (key && pass) {
        localStorage.setItem(meta.keyStorage, await encryptSecret(key, pass));
      }
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ at: Date.now() }));
      onComplete();
    } catch {
      setError("Something went wrong saving that. You can set keys later in Settings.");
      setSaving(false);
    }
  };

  /** Skip setup but still mark onboarding done so it doesn't reappear. */
  const skip = () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ at: Date.now(), skipped: true }));
    onComplete();
  };

  const SLIDES = [
    {
      eyebrow: "WELCOME",
      title: "The Borrowed Hour",
      body: (
        <>
          <p className="font-body italic text-sm text-cream-dim leading-[1.7]">
            An hour is lent to you — a single turn of a story told in cream and twilight. You choose what happens; an AI narrator tells how it unfolds.
          </p>
          <p className="font-body italic text-sm text-cream-faint leading-[1.7] mt-3">
            A few things before the clock starts.
          </p>
        </>
      ),
    },
    {
      eyebrow: "YOUR KEYS, YOUR BROWSER",
      title: "Bring your own model",
      body: (
        <>
          <p className="font-body italic text-sm text-cream-dim leading-[1.7]">
            The story is told by a model you bring. Your API keys are encrypted with a passphrase you choose and kept only in this browser's storage — they're never sent anywhere except the provider's own API.
          </p>
          <p className="font-body italic text-sm text-cream-faint leading-[1.7] mt-3">
            The passphrase is asked for once a session and held in memory. Forget it and your stored keys simply stay locked — nothing is lost, you just re-enter them.
          </p>
        </>
      ),
    },
    {
      eyebrow: "SET THE LOCK",
      title: "Choose a passphrase",
      body: (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="onboarding-passphrase"
              className="font-display font-medium text-cream-dim tracking-display text-[10px] uppercase block mb-[5px]"
            >
              Session passphrase
            </label>
            <input
              id="onboarding-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Choose a passphrase…"
              aria-label="Session passphrase"
              autoComplete="new-password"
              className={`${FIELD_SETTINGS} w-full`}
            />
          </div>
          <div>
            <label
              htmlFor="onboarding-apikey"
              className="font-display font-medium text-cream-dim tracking-display text-[10px] uppercase block mb-[5px]"
            >
              {meta.name} API key <span className="opacity-60">(optional)</span>
            </label>
            <input
              id="onboarding-apikey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Paste a ${meta.name} key, or add one later…`}
              aria-label={`${meta.name} API key`}
              autoComplete="off"
              className={`${FIELD_SETTINGS} w-full`}
            />
            <p className="font-body italic text-cream-faint text-[11px] leading-normal mt-1">
              Encrypted with your passphrase before it touches storage. You can add or change keys anytime under Settings → System.
            </p>
          </div>
          {error && (
            <p className="font-body text-[11px] leading-normal text-[rgba(200,120,100,0.9)]">
              {error}
            </p>
          )}
        </div>
      ),
    },
  ];

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <Modal onClose={() => {}} panelClassName="!max-w-[480px]">
        <div className="px-6 py-5 border-b border-cream/10">
          <div className="font-display font-medium text-[10px] mb-1 text-cream-faint tracking-[0.4em]">
            {current.eyebrow}
          </div>
          <h2 className="font-display font-medium text-xl text-cream-bright tracking-[0.04em]">
            {current.title}
          </h2>
        </div>

        <div className="overflow-y-auto px-6 py-5 min-h-[180px]">
          {current.body}
        </div>

        <div className="px-6 py-4 border-t border-cream/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2" aria-hidden="true">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-[background] duration-[250ms] ${i === slide ? "bg-rose-gold" : "bg-cream/25"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {slide > 0 && (
              <IconButton onClick={() => setSlide(slide - 1)} pad="px-4 py-2" disabled={saving}>
                BACK
              </IconButton>
            )}
            {!isLast ? (
              <>
                <IconButton onClick={skip} pad="px-4 py-2" className="opacity-70">
                  SKIP
                </IconButton>
                <IconButton onClick={() => setSlide(slide + 1)} pad="px-[18px] py-2">
                  NEXT <ArrowRight size={12} strokeWidth={1.5} className="ml-0.5" />
                </IconButton>
              </>
            ) : (
              <IconButton onClick={finish} pad="px-[18px] py-2" disabled={saving}>
                {saving ? "SAVING…" : <><Sparkles size={14} strokeWidth={1.5} className="mr-1" />BEGIN</>}
              </IconButton>
            )}
          </div>
        </div>
    </Modal>
  );
}
