# Tests: todo-ui

## How to run
All commands from the repo root. Node 24 (`.nvmrc`).
- Install: `npm ci`, then once `npx playwright install chromium` (add `--with-deps` on a fresh machine/CI).
- Lint / format check / typecheck: `npm run lint`, `npm run format:check` (`npm run format` fixes), `npm run typecheck`.
- Unit: `npm test` (node:test, `test/unit/*.test.js`).
- Build (needed before page tests): `npm run build` -> `dist/todo.html`.
- Acceptance / e2e: `npm run test:acceptance` = CLI tests (`npm run test:acceptance:cli`, node:test on the real
  `bin/todo-sync.mjs`) then page tests (`npm run test:acceptance:page`, Playwright, Chromium, projects `mobile`
  375x812 and `desktop` 1280x800, against `dist/todo.html`).
- Run the page locally with the fake db and demo data: `npm run dev` (http://127.0.0.1:5173/).
- CI: `.github/workflows/ci.yml` (check `ci`) runs install, lint, format check, typecheck, unit, build, Playwright
  Chromium install, acceptance. `acceptance-guard` blocks PRs touching `tests/acceptance/` or
  `.github/workflows/` unless Martin adds the `acceptance-change` label.

## Skipped until implemented
Every acceptance case is skipped (CI is green) and names the task that implements it (`pending("T-00x")` /
`pending(test, "T-00x")`). To un-skip, the task PR (which must carry the `acceptance-change` label) replaces
`pending("T-00x")` by `{}` in `*.test.js`, and `pending(test, "T-00x")(` by `test(` in `*.spec.js`.
To run all skipped cases now (expect failures until built): `RUN_PENDING=1 npm run test:acceptance` (for page runs add `-- --timeout=5000` so failures do not take 30 s each).

## Test support (not acceptance tests)
- `test/fake-claude.js`: in-memory fake of `window.claude.use("db")` (doc/collection refs, get/set/update/delete,
  onSnapshot, where/orderBy/limit). Config via `window.__FAKE_CLAUDE_CONFIG = {seed, dbNull, failWrites}`; handle
  `window.__fakeClaude` has `attempts`, `writes`, `failWrites`, `dump()`, `externalSet/externalDelete(path)`
  (change the db as HAL's sync would), `subscriptions`. Unit-tested in `test/unit/fake-claude.test.js`.
- `test/page-helpers.js`: `openPage(page, {seed, dbNull, failWrites})` installs a fixed clock (Playwright
  `page.clock`, now = 2026-10-14 12:00 Europe/Bratislava; context timezone is Europe/Bratislava) plus the fake,
  then loads `dist/todo.html`; `seedTodos`, `dbState`, `pending`.
- `test/cli-helpers.js`: runs the real CLI (TZ=UTC) on temp copies of `test/fixtures/*.md` (synthetic only).

## DOM contract for page tests (the builder must produce this markup)
- All content renders inside `<main>`.
- `[data-testid=open-list]` contains `[data-testid=todo-item]` (open items, in display order). Each item has
  `[data-testid=title]`, optional `[data-testid=due]`, `[data-testid=meta]` (plain text, under the title),
  `[data-testid=tick]` (button, >= 44x44 px), `data-due-state="overdue|today|none"`, and, when overdue/today, a
  `[data-testid=badge]` with `aria-label` containing "overdue" / "due today" (no badge otherwise).
- `[data-testid=done-section]` is a `<details>` (closed by default) with `<summary>Done (n)</summary>` and
  `[data-testid=done-item]` children (each with `[data-testid=title]`, no buttons or checkboxes).
- After a tick: the item leaves the open list at once, a button named "Undo" is shown for ~4 s, then one
  `update({tickedAt})` on `todos/<id>`. A failed write puts the item back and shows an element with `role=alert` (error message for the rejected write).
- `[data-testid=sync-footer]` shows "Synced N h ago" from `meta/sync`; it is hidden/absent when `meta/sync` does not exist.
- Empty db: text "No todos yet — ask HAL to sync todos". `use("db")` null: text mentioning claude.ai and being
  signed in, and no `open-list`.

## REQ -> tests
Status: all CLI cases pass (T-006 un-skipped the preview and SKILL.md cases). "Un-skipped by" is the PLAN.md task whose PR enables the case.

| REQ | Acceptance test (file :: case) | Un-skipped by |
|---|---|---|
| REQ-001 | page-list.spec.js :: sorted by due, undated last | T-003 |
| REQ-001 | page-list.spec.js :: ties keep file order | T-003 |
| REQ-002 | page-list.spec.js :: due today uses local date (00:30 Bratislava) | T-003 |
| REQ-001 | page-list.spec.js :: titles are listed | T-001 |
| REQ-001 | page-list.spec.js :: due date shown for dated items | T-003 |
| REQ-001 | page-list.spec.js :: HTML in a title shown literally | T-003 |
| REQ-001 | page-list.spec.js :: meta under title, not a link | T-003 |
| REQ-002 | page-list.spec.js :: overdue marked with accessible label | T-003 |
| REQ-002 | page-list.spec.js :: due today marked, not overdue | T-003 |
| REQ-002 | page-list.spec.js :: future/undated have neither mark | T-003 |
| REQ-003 | page-list.spec.js :: collapsed Done (2), expand, newest first | T-003 |
| REQ-003 | page-list.spec.js :: done > 7 days ago hidden | T-003 |
| REQ-004 | page-tick.spec.js :: tick + 5 s writes tickedAt, in done section | T-004 |
| REQ-004 | page-tick.spec.js :: Undo within 4 s, no write | T-004 |
| REQ-004 | page-tick.spec.js :: done items have no un-tick control | T-004 |
| REQ-004 | page-tick.spec.js :: failed write rolls back with error | T-004 |
| REQ-005 | page-list.spec.js :: list updates live | T-003 |
| REQ-005 | page-list.spec.js :: footer "Synced 2 h ago" | T-004 |
| REQ-005 | page-list.spec.js :: empty state message | T-001 |
| REQ-005 | page-list.spec.js :: `use("db")` null message, no list | T-003 |
| REQ-006 | page-layout.spec.js :: no horizontal scroll at 375x812 | T-003 |
| REQ-006 | page-layout.spec.js :: tick targets >= 44x44 | T-003 |
| REQ-006 | page-layout.spec.js :: dark / light / background changes (3 cases) | T-003 |
| REQ-007 | cli-parse.test.js :: title, due, meta from real-format lines incl. done item with trailing link (via `plan`) | T-002 |
| REQ-007 | cli-parse.test.js :: no-op write is byte-identical (3 fixtures, via `apply`) | T-005 (needs `apply`) |
| REQ-007 | cli-parse.test.js :: ids assigned, nothing else changes | T-005 (needs `apply`) |
| REQ-007 | cli-parse.test.js :: second apply adds no ids | T-005 |
| REQ-008 | cli-plan.test.js :: new item -> set + set meta/sync | T-001 |
| REQ-008 | cli-plan.test.js :: set X, update Y (no tickedAt), delete Z, set meta/sync | T-005 |
| REQ-008 | cli-plan.test.js :: archived items not set/updated | T-005 |
| REQ-008 | cli-plan.test.js :: rows as `{docs:[{id,data}]}` | T-005 |
| REQ-009 | cli-apply.test.js :: tick -> `[x] (done date)` top of Done, summary | T-005 |
| REQ-009 | cli-apply.test.js :: old done -> Archive (created if missing) | T-005 |
| REQ-009 | cli-apply.test.js :: already-done / unknown id skipped | T-005 |
| REQ-009 | cli-apply.test.js :: `--dry-run` leaves file untouched | T-005 |
| REQ-010 | cli-preview.test.js :: preview lists open+done items, no writes | T-006 |
| REQ-010 | cli-preview.test.js :: SKILL.md: ticks = consent, reported | T-006 |
| REQ-010 | cli-preview.test.js :: SKILL.md: add/edit needs explicit yes | T-006 |
| REQ-010 | cli-preview.test.js :: SKILL.md: db rows untrusted | T-006 |

Interpretations the tests make where the PRD is silent (builders: follow, or raise a plan change): combined meta is
`<remind parts> · details: <file>` (from REQ-001's example); archived items with a db row get a `delete` op;
`order` is only asserted to be a number increasing with file order; `skipped` entries are strings or `{id,...}`;
a done date exactly 7 days old is not tested.
