import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{js,jsx}"],
    setupFiles: ["src/__tests__/vitest-setup.js"]
  }
});
