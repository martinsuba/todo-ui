# Status: todo-ui
Phase: build   <!-- planning | plan review | harness | harness review | build | deploy | paused -->
Current task: T-002 full parser + byte-exact writer — in progress (branch task/T-002-parser)
Open PRs: –
Blockers: –
Next step: builder implements T-002 → PR → CI → reviewer

## Decisions log
- 2026-10-14: project created
- 2026-10-14: TODO.md stays master; artifact is read-only view + tick done (D-001)
- 2026-10-14: sync by HAL on its edits and on request, no cron (D-002); page tick = consent (D-003)
- 2026-10-14: stable `<!-- id -->` comments in TODO.md (D-004); done items archived to `## Archive` after 7 days
- 2026-10-14: no tags/filters, no un-tick (4 s undo instead, D-006); stack: plain JS + Node CLI (D-005)
- 2026-10-14: Plan v1 approved (PR #1 merged)
- 2026-10-14: harness PR #2 opened; review round 1 fixes applied (PLAN.md test tags realigned: apply-based cli-parse cases moved T-002 → T-005)
- 2026-10-14: harness PR #2 merged; build phase started with T-001
- 2026-10-14: T-001 review notes for later tasks: PLAN gap — no task explicitly plans set ops for DONE items
  (needed by REQ-008 and T-003 Done section) → propose adding to T-002 when proposing it; T-003 must cover the
  null-db AND snapshot-error paths (app.js currently swallows errors) and move sorting into view.js.
- 2026-10-14: T-001 merged (PR #3). T-002 approved incl. done-item set ops in plan (fills PLAN gap)
