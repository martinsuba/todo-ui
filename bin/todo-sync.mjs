#!/usr/bin/env node
// todo-sync CLI: preview | plan | apply (see docs/ARCHITECTURE.md "CLI contract").
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseTodo } from "../src/sync/parse.js";
import { applyFile } from "../src/sync/apply.js";
import { planOps, toArtifactData } from "../src/sync/plan.js";
import { renderPreview } from "../src/sync/preview.js";
import { readRowsDir, validateRows } from "../src/sync/rows.js";
import { readUtf8 } from "../src/sync/write.js";

const USAGE =
  "usage: todo-sync <preview|plan|apply> --file <TODO.md> (--rows <rows.json> | --rows-dir <dir>) [--now <ISO>] [--dry-run] [--meta-version <n>] [--format neutral|artifactdata]";
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
        "rows-dir": { type: "string" },
        "meta-version": { type: "string" },
        format: { type: "string" },
        now: { type: "string" },
        "dry-run": { type: "boolean" },
      },
      allowPositionals: false,
    }).values;
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), 64);
  }
  if (!args.file) fail("--file is required", 64);
  if (args.rows && args["rows-dir"]) fail("use either --rows or --rows-dir, not both", 64);
  if (!args.rows && !args["rows-dir"]) fail("--rows or --rows-dir is required", 64);
  if (command !== "plan" && (args.format || args["meta-version"]))
    fail("--format and --meta-version are only valid for plan", 64);
  if (args.format && args.format !== "neutral" && args.format !== "artifactdata")
    fail(`invalid --format: ${args.format}`, 64);
  let metaVersion;
  if (args["meta-version"] !== undefined) {
    if (!/^\d+$/.test(args["meta-version"]))
      fail(`invalid --meta-version: ${args["meta-version"]}`, 64);
    metaVersion = Number(args["meta-version"]);
  }
  if (args["dry-run"] && command !== "apply") fail("--dry-run is only valid for apply", 64);
  const now = args.now ? new Date(args.now) : new Date();
  if (Number.isNaN(now.getTime())) fail(`invalid --now: ${args.now}`, 64);
  try {
    let raw;
    if (args["rows-dir"]) {
      const dir = readRowsDir(args["rows-dir"]);
      for (const w of dir.warnings) console.error(`warning: ${w}`);
      raw = dir.rows;
    } else {
      raw = JSON.parse(readFileSync(/** @type {string} */ (args.rows), "utf8"));
    }
    if (command === "apply") {
      const summary = applyFile(args.file, raw, {
        now,
        dryRun: Boolean(args["dry-run"]),
        warn: (m) => console.error(`warning: ${m}`),
      });
      for (const sk of summary.skipped) {
        if (sk.reason === "ambiguous id")
          console.error(`warning: id ${sk.id} is on several lines; skipped`);
      }
      console.log(JSON.stringify(summary, null, 2));
    } else {
      const { rows, skipped } = validateRows(raw, { checkTickedAt: false });
      for (const s of skipped) console.error(`warning: ignoring row ${s.id ?? "?"}: ${s.reason}`);
      const { items, warnings } = parseTodo(readUtf8(args.file).text);
      for (const w of warnings) console.error(`warning: ${w}`);
      const out = planOps(items, {
        now,
        rows,
        metaVersion,
        warn: (m) => console.error(`warning: ${m}`),
      });
      console.log(
        JSON.stringify(args.format === "artifactdata" ? toArtifactData(out.ops) : out, null, 2),
      );
    }
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
} else if (command === "preview") {
  let file;
  try {
    file = parseArgs({
      args: process.argv.slice(3),
      options: { file: { type: "string" } },
      allowPositionals: false,
    }).values.file;
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), 64);
  }
  if (!file) fail("--file is required", 64);
  try {
    const { items, warnings } = parseTodo(readUtf8(file).text);
    process.stdout.write(renderPreview(items, warnings));
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
} else {
  console.error(USAGE);
  process.exit(command ? 1 : 64);
}
