# todo-ui

Private claude.ai artifact page for TODO.md plus the `todo-sync` CLI. TODO.md is the master; the page is a view.

## Running a sync

HAL does this (procedure: `hal/skills/todo-sync/SKILL.md`), on "sync todos" or after editing TODO.md:

1. ArtifactData `list` `todos` with `out_dir` to a temp dir `$D`, and `get` `meta/sync` for its version `<n>`.
2. `node bin/todo-sync.mjs apply --file TODO.md --rows-dir "$D"` (page ticks into the file, archive, ids).
3. `node bin/todo-sync.mjs plan --file TODO.md --rows-dir "$D" --format artifactdata --meta-version <n>`.
4. Send each printed batch with ArtifactData `batch`. On a version conflict, start over (at most 2 retries).

To see what would be pushed without changing anything: `node bin/todo-sync.mjs preview --file TODO.md`.
