# todo-ui
Follows Martin's framework: ~/.claude/FRAMEWORK.md (skills: plan, harness, next-task, deploy).
State: docs/STATUS.md (read it first). Plan: docs/PRD.md, docs/ARCHITECTURE.md, docs/PLAN.md. Tests: docs/TESTS.md.

## Stack
Node 24, plain ES modules, no framework. Page: `src/page/*` inlined by `scripts/build.mjs` into one file
`dist/todo.html` (claude.ai Artifact, `db` capability). CLI: `bin/todo-sync.mjs` + `src/sync/*`. Tests: node:test
(unit + CLI acceptance), Playwright/Chromium (page acceptance, fake `claude` runtime in `test/fake-claude.js`).
ESLint flat config + Prettier; typecheck = `tsc --noEmit` with `checkJs` on JSDoc-annotated JS. See docs/ARCHITECTURE.md.

## Commands
- Install: `npm ci` (once: `npx playwright install chromium`)
- Build page: `npm run build` (-> dist/todo.html)
- Run page locally (fake db, demo data): `npm run dev` (http://127.0.0.1:5173/)
- Lint / format / typecheck: `npm run lint`, `npm run format:check` (`npm run format` to fix), `npm run typecheck`
- Unit tests: `npm test`
- Acceptance tests: `npm run build && npm run test:acceptance` (CLI: `test:acceptance:cli`, page: `test:acceptance:page`);
  `RUN_PENDING=1` also runs the still-skipped cases
- CI (`ci`) runs all of the above; REQ -> test map and how to un-skip: docs/TESTS.md

## Conventions
- Never edit tests/acceptance/ or .github/workflows/ unless the task says so (acceptance-guard needs the
  `acceptance-change` label). A task un-skips its acceptance cases as listed in docs/TESTS.md.
- Page modules in src/page/ share one scope after the build: no `import`s between them, unique top-level names.
- Render todo text with `textContent` only; follow the "Artifact page contract" in docs/ARCHITECTURE.md.
- Page tests need the DOM contract in docs/TESTS.md (data-testid attributes).
- Fixtures in test/fixtures/ are synthetic: never copy real todos into the repo.
- Branches `task/T-001-slug`; commits `T-001: <what>`; PR body: what/why, REQs, tests, how tested.
