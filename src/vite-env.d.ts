/// <reference types="vite/client" />

// Vite handles these imports at build time; declare them so `tsc`/`checkJs`
// don't error on `import "./styles/theme.css"` or the test-time `?raw` import.
declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*?raw" {
  const content: string;
  export default content;
}
