// Helpers for Playwright page tests (not acceptance tests themselves).
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PAGE_URL = pathToFileURL(join(root, "dist", "todo.html")).href;

/** Fixed "now" for every page test: 2026-10-14 12:00 in Europe/Bratislava (UTC+2). */
export const NOW = new Date("2026-10-14T12:00:00+02:00");

/** A todos/<id> document as the sync writes it (docs/ARCHITECTURE.md "Data model"). */
export function todoDoc(id, fields = {}, order = 0) {
  return [
    `todos/${id}`,
    { title: id, due: null, meta: null, status: "open", doneAt: null, order, ...fields },
  ];
}

/** Build a seed map from [id, fields] pairs; order follows array position. */
export function seedTodos(items, extra = {}) {
  return {
    ...Object.fromEntries(items.map(([id, fields], i) => todoDoc(id, fields, i))),
    ...extra,
  };
}

/**
 * Load dist/todo.html with the fake claude runtime and a fixed clock.
 * options: { seed, dbNull, failWrites, now }
 */
export async function openPage(
  page,
  { seed = {}, dbNull = false, failWrites = false, now = NOW } = {},
) {
  await page.clock.install({ time: now });
  await page.addInitScript(
    (cfg) => {
      window.__FAKE_CLAUDE_CONFIG = cfg;
    },
    { seed, dbNull, failWrites },
  );
  await page.addInitScript({ path: join(root, "test", "fake-claude.js") });
  await page.goto(PAGE_URL);
}

/** Current test-handle state: { attempts, writes, dump }. */
export function dbState(page) {
  return page.evaluate(() => ({
    attempts: window.__fakeClaude.attempts,
    writes: window.__fakeClaude.writes,
    dump: window.__fakeClaude.dump(),
  }));
}

/**
 * Returns `test` when RUN_PENDING=1 is set, otherwise `test.skip`. Page acceptance tests are written as
 * `pending(test, "T-003")("REQ-001: ...", async ({ page }) => {...})`; the task that implements the REQ
 * replaces that prefix with plain `test(` (see docs/TESTS.md).
 */
export function pending(test, task) {
  void task;
  return process.env.RUN_PENDING ? test : test.skip;
}
