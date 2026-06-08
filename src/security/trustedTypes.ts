// Trusted Types support for the strict production CSP.
//
// index.html enforces `require-trusted-types-for 'script'`, so the browser
// rejects a raw string assigned to a script-injection sink. The app has exactly
// one such sink: the lazy <script> that loads the opt-in Puter TTS SDK (see
// src/tts/adapters/puter.ts). This policy turns that one known-good URL into a
// TrustedScriptURL and refuses anything else, so enforcement can stay on without
// breaking Puter. `puter-loader` is the only name the CSP `trusted-types`
// allowlist permits; creating a policy under any other name is rejected.
//
// When Trusted Types is unavailable — non-Chromium browsers, or the dev server,
// which strips the directive (vite.config.js) — we fall back to the plain
// string; sink assignment is unguarded there, so it is safe.
//
// The standard DOM lib doesn't ship the Trusted Types interfaces, and we avoid
// pulling in @types/trusted-types, so we model the minimal surface used here.

interface TrustedScriptURLLike {
  toString(): string;
}
interface TrustedTypesPolicy {
  createScriptURL(input: string): TrustedScriptURLLike;
}
interface TrustedTypesFactory {
  createPolicy(
    name: string,
    rules: { createScriptURL: (input: string) => string },
  ): TrustedTypesPolicy;
}

const PUTER_SDK_URL = "https://js.puter.com/v2/";
const POLICY_NAME = "puter-loader";

let policy: TrustedTypesPolicy | null = null;

function puterPolicy(): TrustedTypesPolicy | null {
  const tt =
    typeof window === "undefined"
      ? undefined
      : (window as { trustedTypes?: TrustedTypesFactory }).trustedTypes;
  if (!tt) return null;
  if (!policy) {
    policy = tt.createPolicy(POLICY_NAME, {
      createScriptURL: (url: string) => {
        if (url !== PUTER_SDK_URL) {
          throw new TypeError(`${POLICY_NAME}: refused script URL "${url}"`);
        }
        return url;
      },
    });
  }
  return policy;
}

/**
 * The Puter SDK URL as a TrustedScriptURL when Trusted Types is active, or the
 * plain string otherwise. Either return value is safe to assign to
 * HTMLScriptElement.src.
 */
export function puterSdkScriptUrl(): TrustedScriptURLLike | string {
  return puterPolicy()?.createScriptURL(PUTER_SDK_URL) ?? PUTER_SDK_URL;
}
