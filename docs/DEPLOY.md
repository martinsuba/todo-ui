# Deploy: todo-ui

## Target
- **Page:** private claude.ai Artifact (owner: Martin), published by the Project Lead with the Artifact tool from
  `dist/todo.html`, capabilities `{db: {rules: [{path: "", read: "owner", write: "owner"}]}}`. Every later publish
  goes to the same artifact URL (recorded below after the first publish).
- **Sync:** the `todo-sync` CLI runs from this repo checkout on agent-vps (`~/projects/todo-ui`, main branch);
  the HAL skill `hal/skills/todo-sync/` is installed into HAL's skills in `~/HAL/ai-assistant/hal-config`.
- No VPS service, no ports, no cloud hosting.

## Environments
Single production artifact. "Staging" = local Playwright run against the fake db plus `todo-sync preview` and
`apply --dry-run` on the real TODO.md.

## How to deploy (needs Martin's approval each time)
1. On main, up to date, CI green: `npm ci && npm run build`.
2. Pre-check: `node bin/todo-sync.mjs preview --file ~/HAL/ai-assistant/todo/TODO.md` → show Martin.
3. Publish `dist/todo.html` (first time: new artifact, icon "checklist"; later: same URL). Record URL below.
4. First deploy only: install the HAL skill (copy `hal/skills/todo-sync/` into hal-config's skills dir, set the
   artifact URL in it); commit in the ai-assistant repo per HAL's rules.
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

## History (date · commit · target · result)
- –
