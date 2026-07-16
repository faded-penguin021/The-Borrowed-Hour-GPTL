import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev-only CSP relaxation. The production CSP in index.html omits
 * `'unsafe-inline'` from `script-src` (hardening against script injection) and
 * from `style-src-elem` (blocking injected inline <style>), but Vite's dev
 * server + React Fast Refresh inject an inline script preamble *and* HMR-managed
 * <style> elements that a strict policy would block. This re-adds
 * `'unsafe-inline'` to both directives for the dev server only; the built output
 * keeps the strict policy untouched.
 *
 * It also strips `require-trusted-types-for 'script'` / `trusted-types`: the
 * production build's only script-injection sink (the Puter loader) is routed
 * through a Trusted Types policy, but Vite's HMR client and error overlay assign
 * strings to script sinks (notably overlay innerHTML), which Trusted Types
 * enforcement would block in dev only. The shipped build keeps the directive.
 *
 * Finally it widens `connect-src` with the `ws:`/`wss:` local origins Vite's HMR
 * websocket uses: the production policy already lists the `http(s)://localhost:*`
 * / `127.0.0.1:*` local-LLM origins, but CSP matches schemes exactly, so the HMR
 * socket (`ws://localhost:<port>`) is refused without a `ws:` entry. Dev only;
 * the built policy keeps just the http(s) local origins.
 */
function devCspRelax() {
  return {
    name: "dev-csp-relax",
    apply: "serve",
    transformIndexHtml(html) {
      return html
        .replace(
          "script-src 'self' https://js.puter.com",
          "script-src 'self' 'unsafe-inline' https://js.puter.com"
        )
        .replace(
          "style-src-elem 'self' https://fonts.googleapis.com",
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com"
        )
        .replace(
          "http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*",
          "http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*"
        )
        .replace(
          "; require-trusted-types-for 'script'; trusted-types puter-loader",
          ""
        );
    },
  };
}

export default defineConfig({
  plugins: [react(), devCspRelax()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Don't inline the modulepreload polyfill: it would be an inline <script>,
    // which the strict production script-src (no 'unsafe-inline') forbids.
    // Native modulepreload is supported by all current target browsers.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendor code into its own chunks so the
        // app entry stays under the 500 kB warning limit and vendor bytes can
        // be cached across app deploys. (vite 8 / rolldown: advancedChunks
        // replaces the old object-form manualChunks.)
        advancedChunks: {
          groups: [
            { name: "react", test: /\/node_modules\/(react|react-dom|scheduler)\// },
            { name: "zod", test: /\/node_modules\/zod\// },
          ],
        },
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    setupFiles: ["src/__tests__/vitest-setup.ts"],
    // Coverage ratchet on the invariant cores (docs/BACKLOG.md B5). Thresholds
    // are pinned ~2 points under the measured baseline: they exist to catch a
    // regression in tested-ness, not to force new coverage. If you add
    // well-tested code and the numbers rise, feel free to ratchet them up.
    coverage: {
      provider: "v8",
      include: ["src/context/**", "src/llm/**", "src/storage/**", "src/export/**", "src/saves/**", "src/hooks/**", "src/tts/**"],
      exclude: ["**/*.test.*"],
      reporter: ["text-summary"],
      // Baseline 2026-07-16 (T5): scope widened to export/saves/hooks/tts.
      // Measured under vitest 4's AST-aware v8 remapping, re-pinned at the same
      // measured−2 policy: lines 43.7, functions 39.4, branches 34.5,
      // statements 40.6. (Prior context/llm/storage-only baseline 2026-07-10 was
      // lines 44.5, functions 45, branches 30.1, statements 42.7.)
      thresholds: { lines: 41, functions: 37, branches: 32, statements: 38 },
    },
  }
});
