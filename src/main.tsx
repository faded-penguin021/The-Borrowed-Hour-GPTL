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

createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Progressive Web App: register the service worker so the shell is installable
// and opens offline. Production only — in dev it would shadow Vite's HMR. The
// path is relative to BASE_URL so it resolves correctly under a GitHub Pages
// subpath as well as at a domain root.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      if (typeof console !== "undefined" && console.warn)
        console.warn("[borrowed] service worker registration failed:", err);
    });
  });
}
