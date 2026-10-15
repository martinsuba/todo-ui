# Deploy: todo-ui

## Target
- **Page:** private claude.ai Artifact (owner: Martin), published by the Project Lead with the Artifact tool from
  `dist/todo.html`, capabilities `{db: {rules: [{path: "", read: "owner", write: "owner"}]}}`. Every later publish
  goes to the same artifact URL (recorded below after the first publish).
- **Sync:** the `todo-sync` CLI runs from this repo checkout on agent-vps (`~/projects/todo-ui`, main branch);
  the HAL skill `hal/skills/todo-sync/` is installed as `~/HAL/.claude/skills/todo-sync/SKILL.md` (HAL runs in
  `~/HAL`; `scripts/sync.sh` mirrors it into `ai-assistant/hal-config/claude/`).
- No VPS service, no ports, no cloud hosting.

## Environments
Single production artifact. "Staging" = local Playwright run against the fake db plus `todo-sync preview` and
`apply --dry-run` on the real TODO.md.

## How to deploy (needs Martin's approval each time)
1. On main, up to date, CI green: `npm ci && npm run build`.
2. Pre-check: `node bin/todo-sync.mjs preview --file ~/HAL/ai-assistant/todo/TODO.md` → show Martin.
3. Publish `dist/todo.html` (first time: new artifact, icon "checklist"; later: same URL). Record URL below.
4. Install/refresh the HAL skill: copy `hal/skills/todo-sync/SKILL.md` to `~/HAL/.claude/skills/todo-sync/` (the
   artifact URL is already in it). HAL picks it up in its next session (nightly restart, or restart `hal`).
5. Run "sync todos" once (HAL procedure). Verify ArtifactData list/batch shapes match the skill; fix via a PR if not.

## Smoke checks after deploy
- ArtifactData `list todos`: count equals open + done (non-archived) items in TODO.md; `meta/sync` updated.
- Martin opens the artifact on phone: list order, overdue mark, dark mode look right.
- Martin ticks one item → after the 4 s undo it shows `tickedAt` in the db; next sync marks it `[x]` in TODO.md.

## Rollback
- Page: republish `dist/todo.html` built from the previous commit to the same URL (db data is kept across publishes).
- TODO.md: it is in the ai-assistant git repo; revert the sync commit there (Martin approves).
- db: re-run a sync from TODO.md (plan deletes/overwrites docs to match the file).

## Secrets needed
None.

## Artifact
https://claude.ai/artifact/WY2RRe4AExNbwth86EzoN9 (private; db rules owner-only)

## History (date · commit · target · result)
- 2026-10-15 · d1245d6 · artifact v1 + first sync (11 todos) · OK; skill fix for list versions pending
