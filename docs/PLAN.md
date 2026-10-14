# Plan: todo-ui
Legend: [ ] todo · [~] in progress · [x] done

Harness (before M1, test-architect): repo skeleton per ARCHITECTURE (package.json, ESLint, Prettier, tsconfig
checkJs, `scripts/build.mjs`, `test/fake-claude.js`, empty page that builds), CI (`ci`: lint, format check,
typecheck, unit, build, acceptance; `acceptance-guard`), acceptance tests for REQ-001…REQ-010 (skipped until their
task lands), docs/TESTS.md, CLAUDE.md commands.

Acceptance test files (planned names; test-architect may adjust and record in TESTS.md):
`tests/acceptance/page-list.spec.js` (REQ-001, 002, 003, 005), `page-tick.spec.js` (REQ-004),
`page-layout.spec.js` (REQ-006), `cli-parse.test.js` (REQ-007), `cli-plan.test.js` (REQ-008),
`cli-apply.test.js` (REQ-009), `cli-preview.test.js` (REQ-010).

## M1: MVP — view TODO.md on the phone and tick items done

### [x] T-001: Thin end-to-end slice  (size M)
- Goal: a TODO.md with plain open items flows file → `todo-sync plan` ops → (fake) db → page list.
- REQs: REQ-001 (titles only, file order), REQ-008 (set ops for new items + meta/sync), REQ-005 (empty state)
- Acceptance tests to make pass: the REQ-001 "titles listed" and REQ-005 "empty state" cases; REQ-008 "new item →
  set" case.
- Areas/files: `src/sync/parse.js` (open/done checkbox lines, ids if present), `src/sync/plan.js`,
  `bin/todo-sync.mjs plan`, `src/page/{index.html,app.js,db.js}`, unit tests.
- Definition of done: code + unit tests, listed acceptance tests pass, CI green, review clean, docs updated if needed
- Notes: XSS-safe rendering (textContent) from the start.

### [x] T-002: Full TODO.md parser and byte-exact writer  (size M)
- Goal: parse due/done/meta/links/sections exactly as PRD describes; write back unchanged files byte-identically;
  `plan` also emits set ops for DONE items (`status:"done"`, `doneAt`), never for archived items.
- REQs: REQ-007, REQ-008 (done items)
- Acceptance tests to make pass: `cli-parse.test.js` (the parse-via-`plan` case)
- Areas/files: `src/sync/parse.js`, `src/sync/write.js`, `test/fixtures/*.md` (synthetic, include diacritics,
  nested parentheses, `remind`, `→ [details](…)`, CRLF-free and trailing-newline variants, missing sections).
- Definition of done: as T-001
- Notes: trailing metadata groups only when their parts start with `due `, `done ` or `remind ` (others stay in
  title). Unknown keys → meta.

### [x] T-003: Page view logic and layout  (size M)
- Goal: sorted open list, overdue/due-today marks, collapsed "Done (n)" with 7-day window, live updates, null-db
  and subscription-error message, light/dark, mobile layout (tick controls rendered; behaviour in T-004).
- REQs: REQ-001, REQ-002, REQ-003, REQ-005 (live + null db), REQ-006
- Acceptance tests to make pass: `page-list.spec.js` (except sync footer), `page-layout.spec.js`
- Areas/files: `src/page/view.js` (+ unit tests with injected "today"), `src/page/app.js`, `styles.css`,
  `index.html`.
- Definition of done: as T-001; follows "Artifact page contract" in ARCHITECTURE.
- Notes: "today" = viewer's local date; tests inject a fixed clock.

### [~] T-004: Tick with undo, sync footer  (size S)
- Goal: tick → done section + 4 s Undo → `update({tickedAt})`; failure rolls back with a message; "Synced X ago"
  footer from `meta/sync`.
- REQs: REQ-004, REQ-005 (footer)
- Acceptance tests to make pass: `page-tick.spec.js`, footer case in `page-list.spec.js`
- Areas/files: `src/page/app.js`, `src/page/db.js`, `src/page/view.js`.
- Definition of done: as T-001
- Notes: one write per tick; no write from snapshot callbacks. Several ticks in a row: each item has its own
  independent 4 s undo window.

### [ ] T-005: `apply` — ticks into TODO.md, archive, ids  (size M)
- Goal: implement `todo-sync apply` (and `--dry-run`) per PRD; `plan` updates existing docs without `tickedAt`,
  deletes docs not in Open/Done.
- REQs: REQ-009, REQ-008 (update/delete cases)
- Acceptance tests to make pass: `cli-apply.test.js`, `cli-plan.test.js`, and the `cli-parse.test.js` apply
  cases (byte-identical no-op, id assignment, no second id)
- Areas/files: `src/sync/apply.js`, `src/sync/plan.js`, `src/sync/write.js`, `bin/todo-sync.mjs`.
- Definition of done: as T-001
- Notes: validate rows (id format, types); unknown/invalid rows reported as skipped, never crash mid-write (write to a
  temp file, then rename).

### [ ] T-006: HAL skill and preview  (size S)
- Goal: `todo-sync preview`; `hal/skills/todo-sync/SKILL.md` with the exact procedure, ArtifactData list → rows.json
  and ops → batch mapping, consent rules (D-003), "keep the id comment when editing a line", untrusted-data rule;
  README section on running a sync.
- REQs: REQ-010
- Acceptance tests to make pass: `cli-preview.test.js`
- Areas/files: `bin/todo-sync.mjs`, `hal/skills/todo-sync/SKILL.md`, `README.md`.
- Definition of done: as T-001
- Notes: ArtifactData shapes get verified during deploy against the real artifact; the skill is adjusted then if
  needed (small fix PR).

## After M1: deploy (deploy skill, per docs/DEPLOY.md)
Preview of the real TODO.md for Martin → publish artifact → install HAL skill → first sync → Martin checks on phone.
