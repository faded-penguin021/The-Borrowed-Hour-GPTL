# AGENTS.md

**Pointer, not content.** The canonical operating instructions for every coding
agent in this repo are in [`CLAUDE.md`](./CLAUDE.md) — read it in full before
touching anything, and note that it states the rules while
[`docs/RUNBOOK.md`](./docs/RUNBOOK.md) holds the procedures they point at, so the
two together are the legislation. This file exists because `AGENTS.md` is the
emerging cross-agent default filename; it must only point, never diverge.

If your harness has no session-start hook, run `scripts/session-start.sh` yourself
first — it is agent-neutral and reads `amh.conf`; set `AMH_REMOTE=1` if you are in a
fresh container that needs `npm ci` run for you. Then start where `CLAUDE.md` says to:
with `docs/STATE.md`.
