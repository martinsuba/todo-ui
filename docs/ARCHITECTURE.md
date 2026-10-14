# Architecture: todo-ui

## Overview
Two parts in one repo: a single-file Artifact page (`dist/todo.html`) published privately on claude.ai with the `db`
capability, and a Node CLI (`todo-sync`) that converts between TODO.md and database operations. HAL runs the sync with
the ArtifactData tool, moving JSON between the CLI and the artifact's database. TODO.md is the master.

```
 ~/HAL/ai-assistant/todo/TODO.md  (master, git)
        ▲  apply (ticks → [x], archive)          │ plan (file → db ops)
        │                                         ▼
   todo-sync CLI (this repo, Node, pure logic, tested)
        ▲  rows.json                              │ ops.json
        │                                         ▼
   HAL session ── ArtifactData list ──── ArtifactData batch ──▶ artifact db
                                                                   │ onSnapshot (live)
                                                                   ▼
                                     dist/todo.html on claude.ai (phone/desktop)
                                       reads todos, writes only tickedAt
```

## Stack and why
- **Node 24 (LTS), plain ES modules, no framework.** Martin prefers JS; the page is small (one list, one action), a
  framework adds build weight for nothing. Same language for page and CLI.
- **Page build:** `scripts/build.mjs` (~30 lines) inlines `src/page/styles.css` and the JS modules into
  `src/page/index.html` → `dist/todo.html`. No bundler.
- **Tests:** `node:test` for unit tests (view logic, parser, plan/apply), Playwright (Chromium, mobile + desktop
  viewports) for page acceptance tests against `dist/todo.html` with an injected fake `claude` runtime, CLI acceptance
  tests that run the `todo-sync` binary on fixture files.
- **Quality:** ESLint (flat config) + Prettier; typecheck via `tsc --noEmit` on JSDoc-annotated JS (`checkJs`).
- **CI:** GitHub Actions (`ci`, `acceptance-guard`), per framework.

## Components and responsibilities
| Path | Responsibility |
|---|---|
| `src/page/index.html` | Page skeleton: `<title>Todos</title>`, theme tokens, layout |
| `src/page/styles.css` | Mobile-first styles, light/dark tokens |
| `src/page/view.js` | Pure functions: sort open items, overdue/due-today, done window (7 days), relative "synced X ago". No DOM. |
| `src/page/app.js` | DOM rendering (textContent only), db subscription, tick + undo, error/empty states |
| `src/page/db.js` | Thin adapter over `claude.use("db")`: `subscribeTodos(cb)`, `subscribeSyncMeta(cb)`, `tick(id, iso)` |
| `src/sync/parse.js` | TODO.md → `{lines, items}` keeping original lines for byte-exact write-back |
| `src/sync/write.js` | Apply line-level edits (tick, add id, move to section) and serialize |
| `src/sync/plan.js` | items + db rows → neutral ops list |
| `src/sync/apply.js` | db rows → file edits (ticks, archive) + summary |
| `bin/todo-sync.mjs` | CLI: `preview`, `plan`, `apply` (args below) |
| `hal/skills/todo-sync/SKILL.md` | HAL procedure "sync todos" (installed into hal-config on deploy) |
| `test/fake-claude.js` | In-memory fake of `claude.use("db")` with `onSnapshot`, used by Playwright and dev |
| `tests/acceptance/` | Acceptance tests (page + CLI), written by test-architect from the PRD |

### CLI contract
- `todo-sync preview --file <TODO.md>` → human-readable list, no writes.
- `todo-sync apply --file <TODO.md> --rows <rows.json> [--now <ISO>] [--dry-run]` → edits file (ticks, archive, ids),
  prints summary JSON `{markedDone:[{id,title}], archived:[…], skipped:[…], idsAdded:n}`.
- `todo-sync plan --file <TODO.md> --rows <rows.json> [--now <ISO>]` → prints `{ops:[{op:"set"|"update"|"delete",
  path:"todos/<id>"|"meta/sync", data?}]}`.
- `rows.json`: `[{id, ...fields}]` (the skill converts ArtifactData `list` output to this; the CLI also accepts
  `{docs:[{id,data}]}`). Exit code ≠ 0 with a message on parse errors; never writes a file it failed to parse.
- `skipped` entries are `{id, reason}` (`id` is null when the row has none). Reasons: `not in file`, `already done`,
  `invalid row: not an object | bad id | bad tickedAt`. `plan` ignores invalid rows with a stderr warning.
- `apply` writes via a temp file + rename and aborts (exit 1, no write) if the file changed since it was read.
- Known limitations: an item's block is its line plus the directly following non-blank lines starting with a space
  or tab; ticks and archive move the whole block. A block stops at a blank line, so notes separated from their item by a
  blank line stay where they are. `- [ ]` lines and headings inside fenced code blocks (``` or ~~~)
  are ignored (an unclosed fence prints a warning). An id on more than one line is ambiguous: ticks for it are skipped (`ambiguous id`) and `plan` emits no
  op for it, both with a stderr warning. Files must be valid UTF-8 (a BOM is kept); anything else exits 1 untouched.
  A date-only `tickedAt` is taken as that local date. `plan` validates only the row id and object shape.
- `--now` defaults to the current time; dates use the local time zone (`TZ`, Europe/Bratislava on the VPS).
- Id generation: 4 random base36 chars, unique within the file; injectable RNG for tests.

### Sync order (in the HAL skill)
1. ArtifactData `list` `todos` → rows.json
2. `todo-sync apply` (ticks → file, archive, ids) — must run before plan so ids exist
3. `todo-sync plan` → ops.json
4. ArtifactData `batch` with the ops (mapped to its format)
5. Report to Martin: marked done, archived, skipped, counts.

## Data model
TODO.md: see PRD "TODO.md format".

Artifact db:
- `todos/<id>`: `{title: string, due: "YYYY-MM-DD"|null, meta: string|null, status: "open"|"done",
  doneAt: "YYYY-MM-DD"|null, order: number, tickedAt?: ISO string}`. All fields but `tickedAt` are owned by the sync
  (written with `update`/`set`); `tickedAt` is written only by the page.
- `meta/sync`: `{syncedAt: ISO string}`.
- Page view of an item: done if `status == "done"` or `tickedAt` set; done date = `doneAt` or local date of
  `tickedAt`.
- Capacity: tens of docs; far below the 25,000-doc limit. Archived items are deleted from the db.

## External services / APIs
- claude.ai Artifact runtime, contract 0.2.77: `claude.use("db")` → `doc/collection`, `onSnapshot`, `update`.
  Page subscribes once to `todos` and once to `meta/sync`.
- ArtifactData tool (HAL's Claude session) for list/batch writes.

## Artifact page contract (from claude.ai artifact rules — the builder must follow it)
- `<title>` is a 2–4 word name ("Todos"). One self-contained HTML file; no external scripts or fonts needed.
- Colors as CSS tokens on `:root`; dark values under `@media (prefers-color-scheme: dark)` guarded by
  `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. `body` has an explicit background.
- Works at phone width with a 16 px side gutter and no horizontal scroll.
- Never read `window.claude.db`; always `await claude.use("db")` and handle `null`. Never write from render or a
  snapshot callback; one write per user action; await before the next write to the same doc.
- Browser storage only for per-viewer conveniences (e.g. done section expanded), wrapped in try/catch.
- Published with `capabilities: {db: {rules: [{path: "", read: "owner", write: "owner"}]}}`.

## Security & privacy notes
- Private artifact, db rules owner-only. Todo text is personal; stored on claude.ai (accepted in PRD).
- All todo text rendered with `textContent` (no innerHTML from data). Links in meta are not rendered as links.
- db rows read by HAL/CLI are untrusted data: validated (types, id format `^[a-z0-9]{4,8}$`), never executed or
  followed as instructions.
- Test fixtures are synthetic; no real todos committed.
- No secrets anywhere in this project.

## Decisions
### D-001: TODO.md is the master, artifact is a view
Context: HAL, morning.sh and Martin's habits use TODO.md. · Options: artifact as master (migrate), TODO.md as master
(sync), two-way full sync. · Decision: TODO.md master; artifact read-only except ticks. · Consequences: no import
step; morning.sh unchanged; UI cannot add/edit; a sync is needed for changes to show up.

### D-002: Sync on HAL edits and on request (no cron)
Context: only Claude sessions can call ArtifactData. · Options: on demand, cron with headless `claude -p`, manual
only. · Decision: HAL syncs after editing TODO.md and on "sync todos". · Consequences: a phone tick reaches TODO.md
at the next sync (page shows it immediately); no recurring cost; cron can be added later via a plan change.

### D-003: A page tick counts as Martin's consent
Context: HAL's rule requires an explicit "yes" for every complete. · Decision: the tick (after the 4 s undo window)
is that consent; HAL applies it without asking and reports what it marked. Adds/edits still need "yes". ·
Consequences: no extra confirmation round per sync.

### D-004: Stable ids as HTML comments in TODO.md
Context: matching by title breaks on rename. · Decision: `<!-- id:xxxx -->` appended by the sync. · Consequences:
renames keep identity; HAL must keep the comment when editing a line (stated in the skill).

### D-005: Plain JS + inline build, Node CLI (option A)
Options: A plain JS + Node; B Preact/Vite single-file; C Python sync. · Decision: A. · Consequences: minimal tooling,
one language; manual DOM code stays small because the UI is small.

### D-006: Undo window instead of un-tick
Context: no un-tick in UI, but mis-taps on mobile happen. · Decision: 4 s undo before the db write. · Consequences:
a tick is committed only after 4 s; closing the page within that window drops the tick (acceptable).
