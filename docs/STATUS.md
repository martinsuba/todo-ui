# Status: todo-ui
Phase: harness   <!-- planning | plan review | harness | harness review | build | deploy | paused -->
Current task: –
Open PRs: –
Blockers: –
Next step: run the `harness` skill (test-architect builds skeleton, CI, acceptance tests) on branch `harness`

## Decisions log
- 2026-10-14: project created
- 2026-10-14: TODO.md stays master; artifact is read-only view + tick done (D-001)
- 2026-10-14: sync by HAL on its edits and on request, no cron (D-002); page tick = consent (D-003)
- 2026-10-14: stable `<!-- id -->` comments in TODO.md (D-004); done items archived to `## Archive` after 7 days
- 2026-10-14: no tags/filters, no un-tick (4 s undo instead, D-006); stack: plain JS + Node CLI (D-005)
- 2026-10-14: Plan v1 approved (PR #1 merged)
