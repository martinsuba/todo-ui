# Status: todo-ui
Phase: deploy   <!-- planning | plan review | harness | harness review | build | deploy | paused -->
Current task: deploy (first deploy 2026-10-15)
Open PRs: chore/deploy-status (this)
Blockers: –
Next step: restart `hal` (or wait for 03:30) → Martin checks the page on his phone, ticks one item, says "sync todos" to HAL → verify → deploy done; then workflow report (ask Martin for input first)

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
- 2026-10-14: builder self-applied acceptance-change on #4; from now on every subagent brief forbids label changes. Proposed: make acceptance-guard accept only Martin's label (needs plan change)
- 2026-10-14: T-002 merged (PR #4). Martin: keep acceptance-guard as is (no label-author check). T-003 started
- 2026-10-14: T-003 notes: 'Nothing open. All done!' empty state added; done items with no known date always shown; same-day done items in file order
- 2026-10-14: T-003 merged (PR #5). T-004 started; independent undo window per ticked item
- 2026-10-14: T-004 unplanned change: scripts/build.mjs import stripping hardened (strict regex, fail on leftover import/export or unparseable bundle, unit test). Accepted edge: item deleted during in-flight tick write shows a 'could not mark' message
- 2026-10-14: T-004 merged (PR #6). T-005 started; ticked-line format option A (keep due, add done group)
- 2026-10-14: T-005 review found 2 blocking data-loss bugs (orphaned child lines, non-UTF-8 corruption) + duplicate ids, fences etc.; all fixed. Known limits documented in ARCHITECTURE (child block stops at blank line, UTF-8 only, ambiguous ids skipped, unclosed fence warning)
- 2026-10-14: lesson: builder and reviewer shared one checkout; reviewer's detached checkout made the builder's push a silent no-op. From now on reviewers use a separate git worktree and builders verify the pushed SHA against origin
- 2026-10-14: T-005 merged (PR #7). T-006 started incl. if_version pass-through and artifactdata batch format (ArtifactData requires if_version on writes to existing docs; batch ≤50)
- 2026-10-14: T-006 review fixes: empty-db first sync tolerated, fresh temp dir per sync attempt. Open until deploy: real ArtifactData list shape (skill stops if rows lack `version`)
- 2026-10-14: T-006 merged (PR #8). M1 complete; all acceptance tests run, none skipped
- 2026-10-14: M1 milestone review (Opus). REQ-001…010 covered. Finding (should fix before deploy): a consumed page tick stays in the db (`tickedAt` is never cleared), so an item reopened in TODO.md is re-ticked by the next apply and the page keeps showing it done; every later sync also reports it as skipped "already done". Proposed fix: plan clears `tickedAt` on rows whose file item is done (needs REQ-008 wording change + acceptance case). Minor: pin TZ=Europe/Bratislava in the skill commands (VPS Node resolves Europe/Prague, same clock). Watch at deploy: list/out_dir shape, `update` null semantics, morning.sh with id comments
- 2026-10-15: Martin: "fix it and then deploy". Plan v2: REQ-008 amended (sync clears consumed ticks, D-007), T-007 added
- 2026-10-15: Plan v2 merged (PR #10). T-007 PR #11: review APPROVE first round. Check at deploy: ArtifactData `update` with `tickedAt: null` stores null or removes the field (both handled)
- 2026-10-15: T-007 merged (PR #11). Deploy approved. Artifact published: https://claude.ai/artifact/WY2RRe4AExNbwth86EzoN9 (private, db owner-only). First sync done by the Project Lead: 11 ids added to TODO.md (only change), 11 todos + meta/sync written
- 2026-10-15: deploy findings: (1) `list` with `out_dir` saves data fields only, no `version` → skill now writes rows.json from the inline list result; (2) HAL runs in ~/HAL, so its skill lives in ~/HAL/.claude/skills/todo-sync (mirrored by scripts/sync.sh to ai-assistant/hal-config/claude), not ~/.claude; (3) HAL must not commit ai-assistant (Stop hook does)
- 2026-10-15: skill fix merged (PR #12) and installed to ~/HAL/.claude/skills/todo-sync/SKILL.md
