#!/usr/bin/env node
// todo-sync CLI: preview | plan | apply (see docs/ARCHITECTURE.md "CLI contract").
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseTodo } from "../src/sync/parse.js";
import { planOps } from "../src/sync/plan.js";

const USAGE =
  "usage: todo-sync <preview|plan|apply> --file <TODO.md> [--rows <rows.json>] [--now <ISO>] [--dry-run]";
const command = process.argv[2];

/** @param {string} msg */
function fail(msg, code = 1) {
  console.error(`todo-sync ${command}: ${msg}`);
  process.exit(code);
}

if (command === "plan") {
  let args;
  try {
    args = parseArgs({
      args: process.argv.slice(3),
      options: {
        file: { type: "string" },
        rows: { type: "string" },
        now: { type: "string" },
      },
    }).values;
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), 64);
  }
  if (!args.file) fail("--file is required", 64);
  const now = args.now ? new Date(args.now) : new Date();
  if (Number.isNaN(now.getTime())) fail(`invalid --now: ${args.now}`, 64);
  let text;
  try {
    text = readFileSync(args.file, "utf8");
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  const { items } = parseTodo(text);
  const out = planOps(items, { now, warn: (m) => console.error(`warning: ${m}`) });
  console.log(JSON.stringify(out, null, 2));
} else if (command === "preview" || command === "apply") {
  console.error(`todo-sync ${command}: not implemented`);
  process.exit(2);
} else {
  console.error(USAGE);
  process.exit(command ? 1 : 64);
}
