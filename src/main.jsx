// @ts-check
import "./storage/shim";
import "./styles/tailwind.css";
import "./styles/theme.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { App } from "./App.jsx";

createRoot(/** @type {HTMLElement} */ (document.getElementById("root"))).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Progressive Web App: register the service worker so the shell is installable
// and opens offline. Production only — in dev it would shadow Vite's HMR. The
// path is relative to BASE_URL so it resolves correctly under a GitHub Pages
// subpath as well as at a domain root.
if (/** @type {any} */ (import.meta).env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${/** @type {any} */ (import.meta).env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      if (typeof console !== "undefined" && console.warn)
        console.warn("[borrowed] service worker registration failed:", err);
    });
  });
}
