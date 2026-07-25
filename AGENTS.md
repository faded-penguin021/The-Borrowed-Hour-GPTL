# AGENTS.md

**Pointer, not content.** The canonical operating instructions for every coding
agent in this repo are in [`CLAUDE.md`](./CLAUDE.md) — read it in full before
touching anything. This file exists because `AGENTS.md` is the emerging
cross-agent default filename; it must only point, never diverge.

If your harness has no session-start hook, run `.claude/hooks/session-start.sh`
yourself first (it installs dependencies with `npm ci`, checks the branch, and
prints the protocol pointer), then start where `CLAUDE.md` says to: with
`docs/STATE.md`.
