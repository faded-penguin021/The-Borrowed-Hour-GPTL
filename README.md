# The Borrowed Hour

### ▶ [**Play it now → faded-penguin021.github.io/The-Borrowed-Hour-GPTL**](https://faded-penguin021.github.io/The-Borrowed-Hour-GPTL/)

**The Borrowed Hour** is a literary interactive text adventure built with Vite, React, and Tailwind. It ships with built-in scenarios plus a custom **Wild** mode, and lets players choose LLM, image, text-to-speech, and ambience settings at runtime.

The project began as a single-file HTML artifact and is now a small web app. `src/App.tsx` is now a thin top-level shell; the turn-by-turn game loop lives in `src/context/`, while providers, settings, storage, TTS, ambience, and UI pieces are split into focused modules under `src/`.

## What makes it different

- **No backend, by design.** Every request — LLM, image, TTS — goes straight from your browser to the provider using your own API key. There's no server for this project to run or for your keys to pass through.
- **A GM that doesn't leak its reasoning.** Turns are split across three model roles (opening scene, hidden GM logic, player-facing narration), optionally on different providers, so the rules adjudicator's bookkeeping never bleeds into the prose you read.
- **Wild mode.** Beyond the built-in scenarios, you can describe your own premise and the same engine runs it.
- **Encrypted keys, local saves.** API keys are AES-GCM encrypted at rest behind a session passphrase, with auto-lock when the tab is backgrounded. Saves and chronicles stay in this browser's local storage, unencrypted — they hold your story (including the hidden GM state), not your secrets. See `THREAT_MODEL.md`.
- **Reactive atmosphere.** An "Art Director" step turns scene state into image prompts, and a Web Audio ambience engine scores the story live — both optional, both driven by the same turn state.

## Run locally

### Prerequisites

- Node.js 24 (the version CI and the Pages deploy build with; 20+ should work locally)
- npm

### Development

```bash
npm ci
npm run dev
```

Open the Vite URL shown in your terminal, usually <http://localhost:5173>.

### Production build

```bash
npm run build
npm run preview
```

The production build is written to `dist/`. Pushes to `main` are deployed to GitHub Pages by `.github/workflows/pages.yml`.

## Useful commands

```bash
npm test
npm run typecheck
npm run gen:icons
```

- `npm test` runs the Vitest suite.
- `npm run typecheck` runs TypeScript checks without emitting files.
- `npm run gen:icons` regenerates committed PWA icons in `public/`.

## App notes

- The app can be installed as a PWA from supported browsers.
- API keys are entered in the in-app Settings panel and stored in browser-local storage.
- Local LLM endpoints require their server to allow the origin that serves the app, such as `http://localhost:5173` during development.
- More detailed provider, architecture, PWA, and file-structure notes live in the [project wiki notes](docs/wiki.md).

## Contributing and security

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change and [SECURITY.md](SECURITY.md) before reporting a vulnerability.

## License

The Borrowed Hour is available under the [MIT License](LICENSE).
