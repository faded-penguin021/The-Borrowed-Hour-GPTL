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
        // be cached across app deploys.
        manualChunks: {
          react: ["react", "react-dom"],
          zod: ["zod"],
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
      include: ["src/context/**", "src/llm/**", "src/storage/**"],
      exclude: ["**/*.test.*"],
      reporter: ["text-summary"],
      // Baseline 2026-07-10: lines 55.7, functions 52, branches 76.7.
      thresholds: { lines: 53, functions: 50, branches: 74, statements: 53 },
    },
  }
});
