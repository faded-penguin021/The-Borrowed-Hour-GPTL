// Must precede any module that builds a Zod schema: sets `jitless` so Zod's
// JIT `new Function` probe never runs under the strict (Trusted Types) CSP.
import "./llm/zodConfig";

import "./storage/shim";
import "./styles/tailwind.css";
import "./styles/theme.css";

// Capture console/errors for the opt-in on-screen debug overlay (mobile).
import { installDebugCapture } from "./debug/debugLog";
installDebugCapture();

import React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { App } from "./App";
import { serviceWorkerScriptUrl } from "./security/trustedTypes";

createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Progressive Web App: register the service worker so the app is installable.
// It does not provide offline support — the game needs the network — so this is
// purely about installability. Production only; in dev it would shadow Vite's
// HMR. The path is relative to BASE_URL so it resolves correctly under a GitHub
// Pages subpath as well as at a domain root.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // register() is a TrustedScriptURL sink; under the production CSP a raw
    // string is rejected, so route the URL through the sw-loader policy. Its
    // DOM type is string, matching the plain-string fallback off-Chromium.
    const swUrl = serviceWorkerScriptUrl() as string;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      if (typeof console !== "undefined" && console.warn)
        console.warn("[borrowed] service worker registration failed:", err);
    });
  });
}
