import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "public", "scripts", "*.config.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Underscore-prefixed identifiers are the codebase's signal for
      // intentionally-unused bindings; ignored caught errors are common in the
      // best-effort storage/TTS fallback paths.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Empty `catch (_) {}` blocks are deliberate best-effort fallbacks.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Enforced now that strict mode lands: no new TS-syntax `any`. The sole
      // sanctioned exception (the external `window.puter` SDK) is disabled inline.
      "@typescript-eslint/no-explicit-any": "error",
      // Script-injection sinks. Production CSP enforces Trusted Types, which
      // rejects these at runtime — these rules move the failure to commit
      // time. Sanctioned sinks route through src/security/trustedTypes.ts.
      "no-eval": "error",
      "no-new-func": "error",
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Trusted Types blocks this in production. Sanctioned sinks go through src/security/trustedTypes.ts." },
        { property: "outerHTML", message: "Trusted Types blocks this in production. Sanctioned sinks go through src/security/trustedTypes.ts." },
        { property: "insertAdjacentHTML", message: "Trusted Types blocks this in production. Sanctioned sinks go through src/security/trustedTypes.ts." },
        { object: "document", property: "write", message: "Trusted Types blocks this in production. Sanctioned sinks go through src/security/trustedTypes.ts." },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "React HTML injection is banned; render text (React escapes it) or go through src/security/trustedTypes.ts." },
      ],
    },
  },
  {
    // Test files run under Vitest with global describe/it/expect/vi.
    files: ["src/**/*.test.{js,jsx,ts,tsx}", "src/__tests__/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
