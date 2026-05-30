// @ts-check
import { useState, useRef, useEffect } from "react";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "../data/constants.js";
import { providerSupportsToolUse, FREE_MODELS_BY_PROVIDER } from "../llm/providers.js";

/**
 * @returns {{
 *   settings: AppSettings,
 *   updateSetting: (key: string, value: any) => void
 * }}
 */
export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(SETTINGS_KEY);
        if (r?.value) {
          const parsed = JSON.parse(r.value);
          const merged = { ...DEFAULT_SETTINGS, ...parsed };
          merged.codex = {
            ...DEFAULT_SETTINGS.codex,
            ...(parsed.codex || {}),
            providerConfig: {
              ...DEFAULT_SETTINGS.codex.providerConfig,
              ...((parsed.codex && parsed.codex.providerConfig) || {})
            }
          };
          if (!merged.codex.timeoutMs || merged.codex.timeoutMs <= 20000) {
            merged.codex.timeoutMs = DEFAULT_SETTINGS.codex.timeoutMs;
          }
          for (const role of ["engineOpening", "engineGM", "engineNarrator"]) {
            const eng = merged[role];
            if (eng?.provider === "gemini" && (eng.model === "gemini-3.1-flash-lite" || eng.model === "gemini-flash-lite-latest"))
              merged[role] = { ...eng, model: "gemini-3.5-flash" };
          }
          if (merged.engineStack && merged.engineStack !== "free" && !providerSupportsToolUse(merged.engineStack)) {
            merged.engineStack = "free";
            if (!merged.freeModelSelection) {
              const preset = FREE_MODELS_BY_PROVIDER.free;
              const prov = preset.provider || "mistral";
              merged.engineOpening  = { provider: prov, model: preset.opener };
              merged.engineGM       = { provider: prov, model: preset.gm };
              merged.engineNarrator = { provider: prov, model: preset.narrator };
            }
          }
          if (merged.engineOpening?.provider && !providerSupportsToolUse(merged.engineOpening.provider))
            merged.engineOpening = DEFAULT_SETTINGS.engineOpening;
          if (merged.engineGM?.provider && !providerSupportsToolUse(merged.engineGM.provider))
            merged.engineGM = DEFAULT_SETTINGS.engineGM;
          setSettings(merged);
        }
      } catch {} finally {
        loadedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    (async () => {
      try {
        await window.storage.set(SETTINGS_KEY, JSON.stringify(settings));
      } catch {}
    })();
  }, [settings]);

  const updateSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  return { settings, updateSetting };
}
