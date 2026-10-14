#!/usr/bin/env node
// todo-sync CLI: preview | plan | apply (see docs/ARCHITECTURE.md "CLI contract").
const command = process.argv[2];

if (command === "preview" || command === "plan" || command === "apply") {
  console.error(`todo-sync ${command}: not implemented`);
  process.exit(2);
}
console.error(
  "usage: todo-sync <preview|plan|apply> --file <TODO.md> [--rows <rows.json>] [--now <ISO>] [--dry-run]",
);
process.exit(command ? 1 : 64);
