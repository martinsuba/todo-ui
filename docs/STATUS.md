# Status: todo-ui
Phase: plan review   <!-- planning | plan review | harness | harness review | build | deploy | paused -->
Current task: –
Open PRs: #1 Plan v1 (branch plan/1)
Blockers: –
Next step: Martin reviews and merges the Plan v1 PR; then harness phase (/model sonnet, `harness` skill)

## Decisions log
- 2026-10-14: project created
- 2026-10-14: TODO.md stays master; artifact is read-only view + tick done (D-001)
- 2026-10-14: sync by HAL on its edits and on request, no cron (D-002); page tick = consent (D-003)
- 2026-10-14: stable `<!-- id -->` comments in TODO.md (D-004); done items archived to `## Archive` after 7 days
- 2026-10-14: no tags/filters, no un-tick (4 s undo instead, D-006); stack: plain JS + Node CLI (D-005)
