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
    setupFiles: ["src/__tests__/vitest-setup.ts"]
  }
});
