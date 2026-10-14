#!/usr/bin/env node
// todo-sync CLI: preview | plan | apply (see docs/ARCHITECTURE.md "CLI contract").
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseTodo } from "../src/sync/parse.js";
import { applyFile } from "../src/sync/apply.js";
import { planOps } from "../src/sync/plan.js";
import { validateRows } from "../src/sync/rows.js";
import { readUtf8 } from "../src/sync/write.js";

const USAGE =
  "usage: todo-sync <preview|plan|apply> --file <TODO.md> [--rows <rows.json>] [--now <ISO>] [--dry-run]";
const command = process.argv[2];

/** @param {string} msg */
function fail(msg, code = 1) {
  console.error(`todo-sync ${command}: ${msg}`);
  process.exit(code);
}

if (command === "plan" || command === "apply") {
  let args;
  try {
    args = parseArgs({
      args: process.argv.slice(3),
      options: {
        file: { type: "string" },
        rows: { type: "string" },
        now: { type: "string" },
        "dry-run": { type: "boolean" },
      },
      allowPositionals: false,
    }).values;
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), 64);
  }
  if (!args.file) fail("--file is required", 64);
  if (!args.rows) fail("--rows is required", 64);
  if (args["dry-run"] && command !== "apply") fail("--dry-run is only valid for apply", 64);
  const now = args.now ? new Date(args.now) : new Date();
  if (Number.isNaN(now.getTime())) fail(`invalid --now: ${args.now}`, 64);
  try {
    const raw = JSON.parse(readFileSync(args.rows, "utf8"));
    if (command === "apply") {
      const summary = applyFile(args.file, raw, { now, dryRun: Boolean(args["dry-run"]) });
      for (const sk of summary.skipped) {
        if (sk.reason === "ambiguous id")
          console.error(`warning: id ${sk.id} is on several lines; skipped`);
      }
      console.log(JSON.stringify(summary, null, 2));
    } else {
      const { rows, skipped } = validateRows(raw, { checkTickedAt: false });
      for (const s of skipped) console.error(`warning: ignoring row ${s.id ?? "?"}: ${s.reason}`);
      const { items } = parseTodo(readUtf8(args.file).text);
      const out = planOps(items, {
        now,
        rows,
        warn: (m) => console.error(`warning: ${m}`),
      });
      console.log(JSON.stringify(out, null, 2));
    }
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
} else if (command === "preview") {
  console.error(`todo-sync ${command}: not implemented`);
  process.exit(2);
} else {
  console.error(USAGE);
  process.exit(command ? 1 : 64);
}
