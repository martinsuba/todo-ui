// Helpers for CLI acceptance tests: run the real bin/todo-sync.mjs on files in a temp dir.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BIN = join(root, "bin", "todo-sync.mjs");
export const SKILL_FILE = join(root, "hal", "skills", "todo-sync", "SKILL.md");
export const FIXTURES = join(root, "test", "fixtures");

/** Fixed "now" for CLI tests; TZ is pinned to UTC so dates are deterministic. */
export const NOW = "2026-10-14T12:00:00Z";

export function tempDir() {
  return mkdtempSync(join(tmpdir(), "todo-sync-"));
}

/** Copy a fixture into a fresh temp dir; returns the path of the copy. */
export function copyFixture(name) {
  const dir = tempDir();
  const file = join(dir, "TODO.md");
  cpSync(join(FIXTURES, name), file);
  return file;
}

export function writeText(file, text) {
  writeFileSync(file, text);
  return file;
}

export function writeRows(file, rows) {
  return writeText(join(dirname(file), "rows.json"), JSON.stringify(rows));
}

export const read = (file) => readFileSync(file, "utf8");

/** Run the CLI; returns { status, stdout, stderr }. */
export function run(args) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    encoding: "utf8",
    env: { ...process.env, TZ: "UTC" },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Run and parse stdout as JSON; fails loudly with the CLI output when the exit code is not 0. */
export function runJson(args) {
  const r = run(args);
  if (r.status !== 0) throw new Error(`todo-sync ${args[0]} exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

/** Skip option for node:test: skipped until RUN_PENDING=1, naming the task that un-skips it. */
export const pending = (task) => (process.env.RUN_PENDING ? {} : { skip: `pending ${task}` });
