import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { bundle, stripModule } from "../../scripts/build.mjs";

test("stripModule drops multi-line and single-line imports only", () => {
  const src = [
    'import {\n  a,\n  b,\n} from "./x.js";',
    'import { c } from "./y.js"',
    "// import x here is a comment",
    "const t = `",
    "import fake from nowhere",
    "`;",
    "export function f() {}",
  ].join("\n");
  const out = stripModule(src);
  assert.ok(!out.includes('"./x.js"') && !out.includes('"./y.js"'));
  assert.ok(out.includes("// import x here is a comment"));
  assert.ok(out.includes("import fake from nowhere"));
  assert.ok(out.includes("\nfunction f() {}"));
});

test("bundle fails on leftover imports and unparsable output", () => {
  assert.throws(() => bundle(["import x from y;\nconst a = 1;"]), /import\/export left/);
  assert.throws(() => bundle(["const = ;"]), /does not parse/);
});

test("built dist/todo.html has a parseable script with functions from every module", () => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { stdio: "pipe" });
  const html = readFileSync("dist/todo.html", "utf8");
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m);
  new vm.Script(m[1]);
  for (const marker of ["function sortOpen", "function subscribeTodos", "function renderTodos"]) {
    assert.ok(m[1].includes(marker), marker);
  }
});
