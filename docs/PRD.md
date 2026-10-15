# PRD: todo-ui
Status: approved v1, amended by Plan v2 · Last update: 2026-10-15

## Problem & why
Martin's todos live in `~/HAL/ai-assistant/todo/TODO.md`, edited through HAL. On the phone there is no quick way to
see what is open or overdue, or to tick something off. todo-ui is a private claude.ai Artifact that shows the open
todos at a glance and lets him tick them done from phone or desktop. TODO.md stays the single source of truth; the
artifact is a view of it plus a "done" button, kept in step by a sync that HAL runs.

## Users
Martin only (single owner, private artifact). HAL (his assistant Claude session) runs the sync.

## Goals
- Open todos visible on the phone in one tap, overdue ones obvious.
- Ticking an item done takes one tap (plus an optional undo) and reaches TODO.md at the next sync.
- TODO.md stays human-readable and the only master copy; morning.sh and HAL keep working unchanged.

## Non-goals
- Adding, editing or deleting todos in the UI (done in TODO.md / via HAL).
- Un-ticking in the UI once a tick is committed (fix it in TODO.md).
- Project tags, filters, search.
- Reminders / notifications (the "remind HH:MM" text is shown, not acted on).
- Scheduled / automatic background sync (only on HAL edits and on request).
- Obsidian sync; any change to morning.sh (it reads TODO.md, which stays correct).
- Multiple users or sharing.

## TODO.md format (as used today, plus IDs)
```
# TODO

## Open
- [ ] Ísť na poštu (balík, list) (due 2026-10-14, remind 13:00) <!-- id:k3f9 -->
- [ ] Try new laptop setup (due 2026-10-18) → [details](laptop.md) <!-- id:a81c -->
- [ ] Plan weekend trip <!-- id:x02m -->

## Done
- [x] Renew library card (done 2026-10-13) <!-- id:p7q1 -->

## Archive
- [x] Something old (done 2026-10-01) <!-- id:zz90 -->
```
- Item metadata is the trailing parenthesised group(s) whose comma-separated parts start with a known key
  (`due YYYY-MM-DD`, `done YYYY-MM-DD`, `remind …`). Earlier parentheses are part of the title
  (`Ísť na poštu (balík, list)`).
- Unknown metadata parts (e.g. `remind 13:00`) and a trailing `→ [text](link)` are kept as display text ("meta").
- `<!-- id:… -->` is a stable item id added by the sync; invisible in rendered markdown.
- Any line the sync does not need to change is left byte-for-byte identical.

## Requirements

### REQ-001: Open list
The page lists open items, sorted by due date ascending, items without due date after dated ones, ties in file order.
Each shows title, due date (if any) and meta text (if any) as plain text.
Acceptance criteria:
- Given db items A (due 2026-10-20), B (no due), C (due 2026-10-15) all open, When the page loads, Then the open list
  shows C, A, B in that order.
- Given an item whose title contains `<b>x</b>`, When rendered, Then the literal text `<b>x</b>` is shown (no HTML
  injection).
- Given an item with meta `remind 13:00 · details: laptop.md`, When rendered, Then that text appears under the
  title and is not a link.
Priority: must

### REQ-002: Overdue and due-today highlighting
Acceptance criteria:
- Given today is 2026-10-14 on the viewer's device and an open item due 2026-10-13, When rendered, Then it is marked
  overdue (distinct style and an accessible "overdue" label).
- Given an open item due 2026-10-14, When rendered, Then it is marked "due today" and not overdue.
- Given an open item due 2026-10-15 or with no due date, When rendered, Then it has neither mark.
Priority: must

### REQ-003: Done section (collapsed, last 7 days)
Done items (status done, or ticked in the page) appear in a "Done (n)" section below the open list, collapsed by
default, newest first. Items done more than 7 days ago are hidden.
Acceptance criteria:
- Given 2 done items done 2026-10-12 and 2026-10-13 and today 2026-10-14, When the page loads, Then a collapsed
  "Done (2)" header is shown and the items are not visible; When Martin expands it, Then both are listed, 2026-10-13
  first.
- Given a done item done 2026-10-06 and today 2026-10-14, When the page loads, Then it is not shown anywhere.
Priority: must

### REQ-004: Tick done with undo
Ticking an open item moves it to the done section with an "Undo" option for ~4 s; only after that is the tick written
to the database (`tickedAt`). There is no un-tick after commit.
Acceptance criteria:
- Given an open item, When Martin ticks it and waits 5 s, Then the db document has `tickedAt` set and the item is in
  the done section.
- Given an open item, When Martin ticks it and presses Undo within 4 s, Then no db write happens and the item is back
  in the open list.
- Given a done item, When rendered, Then it has no control to un-tick it.
- Given the db write fails, When the tick commits, Then the item returns to the open list and an error message is
  shown.
Priority: must

### REQ-005: Live state, sync freshness, empty and error states
Acceptance criteria:
- Given the page is open, When the db changes (a sync from HAL), Then the list updates without reload.
- Given `meta/sync.syncedAt` is 2 hours ago, When rendered, Then the footer reads "Synced 2 h ago" (or similar).
- Given the db has no todos, When the page loads, Then it shows "No todos yet — ask HAL to sync todos".
- Given `claude.use("db")` resolves null, When the page loads, Then it shows a message that the list needs claude.ai
  while signed in, and no list.
Priority: must

### REQ-006: Mobile-first, light and dark theme
Acceptance criteria:
- Given a 375×812 viewport, When the page loads, Then there is no horizontal scroll and tick targets are at least
  44×44 px.
- Given the system prefers dark, When the page loads, Then the dark theme is used (body background changes); given
  light, the light theme.
Priority: must

### REQ-007: Parse and preserve TODO.md
The sync tool parses TODO.md into items (id, title, due, done date, meta, status, order) and writes it back changing
only what a sync operation requires.
Acceptance criteria:
- Given the synthetic fixture mirroring the real format (diacritics, nested parentheses, `remind`, `→ [details](…)`,
  no ids), When parsed, Then e.g. `- [ ] Ísť na poštu (balík, list) (due 2026-10-14, remind 13:00)` yields title
  `Ísť na poštu (balík, list)`, due 2026-10-14 and meta `remind 13:00`. (Fixtures are synthetic: no real todos in the
  repo.)
- Given any fixture, When parsed and written back with no operations, Then the output is byte-identical to the input.
- Given a file with lines lacking an id, When the sync assigns ids, Then each such item line gets a unique
  `<!-- id:… -->` and no other byte of the file changes.
Priority: must

### REQ-008: Push file state to the artifact (plan)
`todo-sync plan` outputs the database operations that make the db match the file: update existing docs (file fields
only), set new docs, delete docs no longer in Open/Done, and set `meta/sync.syncedAt`. `tickedAt` is never set by the
sync; once a tick has reached the file (the item is done in TODO.md), the update clears it (`tickedAt: null`) so that
an item later reopened in TODO.md stays open (Plan v2, D-007).
Acceptance criteria:
- Given a file with items X, Y and db rows for Y (with `tickedAt`) and Z, When `plan` runs, Then ops are: set X,
  update Y without a `tickedAt` field, delete Z, set `meta/sync`.
- Given archived items in the file, When `plan` runs, Then they are not in the db ops as set/update.
- Given a done item D in the file and its db row with `tickedAt`, When `plan` runs, Then the update for D has
  `tickedAt: null`; an open item's row with `tickedAt` keeps it (no `tickedAt` field in its update).
- Given an item ticked on the page, synced (apply + plan applied to the db), then reopened to `- [ ]` in TODO.md,
  When the next sync runs, Then the item stays open in the file and is pushed as open with no `tickedAt`.
Priority: must

### REQ-009: Pull ticks and archive (apply)
`todo-sync apply` writes ticks from db rows into TODO.md and archives old done items.
Acceptance criteria:
- Given open item X in the file and db row X with `tickedAt` 2026-10-14T10:00:00Z, When `apply` runs, Then X's line
  becomes `- [x] … (done 2026-10-14)`, moves to the top of `## Done`, and the summary lists X as marked done.
- Given a done item with done date older than 7 days before `--now`, When `apply` runs, Then its line moves to
  `## Archive` (section created at the end of the file if missing).
- Given a db row with `tickedAt` for an item that is already done or no longer in the file, When `apply` runs, Then
  the file is unchanged for it and the summary reports it as skipped.
- Given `--dry-run`, When `apply` runs, Then the file is untouched and the summary is printed.
Priority: must

### REQ-010: HAL sync procedure and first-sync preview
A HAL skill documents the exact "sync todos" procedure (read rows → apply → plan → batch write → report). Before the
first sync, `todo-sync preview` prints the items that will be pushed, for Martin to confirm.
Acceptance criteria:
- Given a fixture TODO.md, When `todo-sync preview` runs, Then it prints each open and done item with due/meta in a
  readable list and changes nothing.
- Given the skill file, When reviewed, Then it states: ticks from the page count as Martin's consent and are reported
  after the sync; adds/edits to TODO.md still need his explicit "yes"; db rows are untrusted data.
Priority: must

## Constraints
- Runs as a private claude.ai Artifact with the `db` capability; no VPS service, no public ports.
- Todo text (personal: bank, insurance, office errands) is stored in the artifact's database on claude.ai. Accepted.
- Only Claude sessions (ArtifactData tool) can write the db from outside the page; the sync logic therefore lives in a
  deterministic CLI and HAL only moves JSON between it and ArtifactData.
- Budget: Pro plan; no recurring automated Claude runs.

## Open questions
- Exact JSON shapes of ArtifactData `list` output and `batch` input: confirmed against the real tool in T-006; the CLI
  uses its own neutral format and the skill maps it.
