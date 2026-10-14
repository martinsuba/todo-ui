// REQ-007: Parse and preserve TODO.md. Runs the real bin/todo-sync.mjs on synthetic fixtures.
// Cases are skipped until the named task lands; the task replaces `pending("T-00x")` with `{}` (docs/TESTS.md).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOW, copyFixture, read, run, runJson, writeRows } from "../../test/cli-helpers.js";

const ID_COMMENT = / <!-- id:[a-z0-9]{4,8} -->/g;

describe("REQ-007 parse and preserve TODO.md", () => {
  it("REQ-007: parses title, due and meta from a real-format line", {}, () => {
    const file = copyFixture("todo-ids.md");
    const rows = writeRows(file, []);
    const { ops } = runJson(["plan", "--file", file, "--rows", rows, "--now", NOW]);
    const set = (id) => ops.find((o) => o.op === "set" && o.path === `todos/${id}`)?.data;

    // nested parentheses stay in the title; the metadata group becomes due + meta
    assert.deepEqual(set("k3f9"), {
      title: "Ísť na poštu (balík, list)",
      due: "2026-10-14",
      meta: "remind 13:00",
      status: "open",
      doneAt: null,
      order: set("k3f9")?.order,
    });
    assert.equal(typeof set("k3f9").order, "number");
    // trailing "→ [details](x.md)" becomes display text
    assert.equal(set("a81c").title, "Try new laptop setup");
    assert.equal(set("a81c").due, "2026-10-18");
    assert.equal(set("a81c").meta, "details: laptop.md");
    // remind and link are joined with " · "
    assert.equal(set("pr10").meta, "remind 09:30 · details: printer.md");
    // no metadata group at all
    assert.deepEqual(
      [set("x02m").title, set("x02m").due, set("x02m").meta],
      ["Plan weekend trip", null, null],
    );
    // parentheses in the title that are not metadata stay in the title
    assert.equal(set("ins7").title, "Zaplatiť poistenie (auto (Škoda), ročné)");
    assert.equal(set("ins7").due, "2026-10-16");
    // done section
    assert.equal(set("p7q1").status, "done");
    assert.equal(set("p7q1").doneAt, "2026-10-13");
    // done item with the link after the done date
    assert.equal(set("fx11").title, "Fix scanner");
    assert.equal(set("fx11").status, "done");
    assert.equal(set("fx11").doneAt, "2026-10-14");
    assert.equal(set("fx11").meta, "details: scanner.md");
    // order follows file order
    const orders = ["k3f9", "a81c", "x02m", "pr10", "ins7", "p7q1", "cof2"].map(
      (id) => set(id).order,
    );
    assert.deepEqual(
      orders,
      [...orders].sort((a, b) => a - b),
    );
  });

  for (const fixture of ["todo-ids.md", "todo-open-only.md", "todo-no-trailing-newline.md"]) {
    it(`REQ-007: parse then write with no operations is byte-identical (${fixture})`, {}, () => {
      // needs `apply`, which lands in T-005 (T-002 delivers the parser/writer used by it).
      // Fixtures carry ids and nothing to tick or archive at NOW, so apply has nothing to change.
      const file = copyFixture(fixture);
      const before = read(file);
      const rows = writeRows(file, []);
      const r = run(["apply", "--file", file, "--rows", rows, "--now", "2026-10-14T12:00:00Z"]);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(read(file), before);
    });
  }

  it("REQ-007: ids are assigned to item lines without one and nothing else changes", {}, () => {
    const file = copyFixture("todo-noids.md");
    const before = read(file);
    const itemLines = before.split("\n").filter((l) => /^- \[[ x]\] /.test(l)).length;
    const rows = writeRows(file, []);
    const summary = runJson(["apply", "--file", file, "--rows", rows, "--now", NOW]);
    const after = read(file);

    assert.equal(summary.idsAdded, itemLines);
    const ids = [...after.matchAll(/<!-- id:([a-z0-9]{4,8}) -->/g)].map((m) => m[1]);
    assert.equal(ids.length, itemLines);
    assert.equal(new Set(ids).size, ids.length, "ids are unique");
    // every item line has exactly one id comment, no other line has one
    for (const line of after.split("\n")) {
      const isItem = /^- \[[ x]\] /.test(line);
      assert.equal((line.match(/<!-- id:/g) || []).length, isItem ? 1 : 0, line);
    }
    // removing the added comments gives back the original bytes
    assert.equal(after.replace(ID_COMMENT, ""), before);
  });

  it("REQ-007: a second apply does not change ids", {}, () => {
    const file = copyFixture("todo-noids.md");
    const rows = writeRows(file, []);
    runJson(["apply", "--file", file, "--rows", rows, "--now", NOW]);
    const once = read(file);
    const summary = runJson(["apply", "--file", file, "--rows", rows, "--now", NOW]);
    assert.equal(summary.idsAdded, 0);
    assert.equal(read(file), once);
  });
});
