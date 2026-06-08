# Contributing

Thanks for your interest in improving The Borrowed Hour.

## Getting started

1. Fork or branch from the current default branch.
2. Install dependencies with `npm ci`. This honors the committed lockfile, matching CI. Use `npm install` only when your change deliberately updates dependencies (see the dependency note in `CLAUDE.md`).
3. Run the app with `npm run dev` and open the local Vite URL.
4. Keep changes focused and describe the player or maintainer impact in your pull request.

## Development checks

Before opening a pull request, run:

```bash
npm test
npm run typecheck
npm run build
```

If a check cannot run in your environment, note that clearly in the pull request.

## Code style

- Keep React components and helpers small when practical.
- Prefer existing provider, settings, TTS, ambience, and storage patterns over one-off implementations.
- Do not commit API keys, generated secrets, or local environment files.
- For visible UI changes, include a screenshot or short screen recording when possible.

## Documentation

Keep the README focused on what the project is and how to run it. Longer explanations, provider notes, architecture details, and operational references belong in `docs/wiki.md` or another wiki-style document.
