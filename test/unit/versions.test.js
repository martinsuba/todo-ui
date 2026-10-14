import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseTodo } from "../../src/sync/parse.js";
import { planOps, toArtifactData } from "../../src/sync/plan.js";
import { readRowsDir, validateRows } from "../../src/sync/rows.js";

const now = new Date("2026-10-14T12:00:00Z");

describe("ifVersion pass-through", () => {
  it("carries row version on update and delete, omits when absent; set has none", () => {
    const { items } = parseTodo(
      "- [ ] A <!-- id:aaa1 -->\n- [ ] B <!-- id:bbb2 -->\n- [ ] C <!-- id:ccc3 -->\n- [ ] N <!-- id:nnn4 -->\n",
    );
    const { ops } = planOps(items, {
      now,
      rows: [
        { id: "aaa1", version: 3 },
        { id: "bbb2" },
        { id: "gone", version: 7 },
        { id: "ccc3", version: "x" },
      ],
    });
    const by = Object.fromEntries(ops.map((o) => [o.path, o]));
    assert.equal(by["todos/aaa1"].ifVersion, 3);
    assert.ok(!("ifVersion" in by["todos/bbb2"]));
    assert.ok(!("ifVersion" in by["todos/ccc3"]));
    assert.ok(!("ifVersion" in by["todos/nnn4"]));
    assert.equal(by["todos/gone"].ifVersion, 7);
    assert.ok(!("ifVersion" in by["meta/sync"]));
  });
  it("metaVersion goes on the meta/sync op", () => {
    const { ops } = planOps([], { now, metaVersion: 4 });
    assert.equal(ops[0].ifVersion, 4);
  });
  it("{docs:[...]} rows keep version", () => {
    const { rows } = validateRows({ docs: [{ id: "abcd", data: { a: 1 }, version: 2 }] });
    assert.equal(rows[0].version, 2);
  });
});

describe("toArtifactData", () => {
  it("maps ops to writes with if_version", () => {
    const { items } = parseTodo("- [ ] A <!-- id:aaa1 -->\n");
    const { ops } = planOps(items, { now, rows: [{ id: "aaa1", version: 2 }], metaVersion: 5 });
    const { batches } = toArtifactData(ops);
    assert.equal(batches.length, 1);
    assert.deepEqual(batches[0][0], {
      op: "update",
      collection: "todos",
      doc_id: "aaa1",
      data: ops[0].data,
      if_version: 2,
    });
    assert.deepEqual(batches[0][1], {
      op: "set",
      collection: "meta",
      doc_id: "sync",
      data: { syncedAt: "2026-10-14T12:00:00.000Z" },
      if_version: 5,
    });
  });
  it("chunks 120 items (+meta, 121 writes) into 3 batches of at most 50", () => {
    const text = Array.from(
      { length: 120 },
      (_, i) => `- [ ] T${i} <!-- id:t${String(i).padStart(3, "0")} -->`,
    ).join("\n");
    const { batches } = toArtifactData(planOps(parseTodo(text + "\n").items, { now }).ops);
    assert.deepEqual(
      batches.map((b) => b.length),
      [50, 50, 21],
    );
    assert.equal(batches[2].at(-1)?.doc_id, "sync");
  });
  it("never addresses a document twice in one batch", () => {
    const { batches } = toArtifactData([
      { op: "set", path: "todos/aaaa", data: {} },
      { op: "update", path: "todos/aaaa", data: {} },
    ]);
    assert.equal(batches.length, 2);
  });
  it("no ops gives no batches", () => {
    assert.deepEqual(toArtifactData([]), { batches: [] });
  });
});

describe("readRowsDir", () => {
  it("reads both doc shapes, uses the filename as id, skips invalid files with a warning", () => {
    const dir = mkdtempSync(join(tmpdir(), "rows-"));
    mkdirSync(join(dir, "todos"));
    const w = (n, c) => writeFileSync(join(dir, "todos", n), c);
    w("aaa1.json", JSON.stringify({ title: "A", version: 2 }));
    w(
      "bbb2.json",
      JSON.stringify({ data: { title: "B", tickedAt: "2026-10-14T10:00:00Z" }, version: 5 }),
    );
    w("ccc3.json", "{not json");
    w("ddd4.json", "[1]");
    w("notes.txt", "x");
    const { rows, warnings } = readRowsDir(dir);
    assert.deepEqual(rows, [
      { title: "A", id: "aaa1", version: 2 },
      { title: "B", tickedAt: "2026-10-14T10:00:00Z", id: "bbb2", version: 5 },
    ]);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /ccc3\.json/);
  });
  it("throws when todos/ is missing", () => {
    assert.throws(() => readRowsDir(mkdtempSync(join(tmpdir(), "rows-"))), /cannot read/);
  });
});
