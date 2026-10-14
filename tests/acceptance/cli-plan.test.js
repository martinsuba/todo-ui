// REQ-008: `todo-sync plan` outputs the db operations that make the db match the file.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOW, copyFixture, pending, runJson, writeRows } from "../../test/cli-helpers.js";

const dbRow = (id, extra = {}) => ({
  id,
  title: `old ${id}`,
  due: null,
  meta: null,
  status: "open",
  doneAt: null,
  order: 0,
  ...extra,
});
const plan = (file, rows) =>
  runJson(["plan", "--file", file, "--rows", writeRows(file, rows), "--now", NOW]).ops;

describe("REQ-008 plan: push file state to the artifact", () => {
  it("REQ-008: a new item becomes a set op, plus set meta/sync", pending("T-001"), () => {
    const file = copyFixture("todo-open-only.md");
    const ops = plan(file, []);
    assert.deepEqual(
      ops.map((o) => [o.op, o.path]),
      [
        ["set", "todos/x001"],
        ["set", "todos/y002"],
        ["set", "meta/sync"],
      ],
    );
    assert.deepEqual(ops[0].data, {
      title: "Pay invoice",
      due: null,
      meta: null,
      status: "open",
      doneAt: null,
      order: ops[0].data.order,
    });
    assert.equal(typeof ops[0].data.order, "number");
    assert.equal(ops[1].data.due, "2026-10-20");
    assert.equal(typeof ops[2].data.syncedAt, "string");
    assert.ok(!Number.isNaN(Date.parse(ops[2].data.syncedAt)));
  });

  it(
    "REQ-008: file X,Y with db rows Y (ticked) and Z gives set X, update Y, delete Z, set meta/sync",
    pending("T-005"),
    () => {
      // X = x001 (new), Y = y002 (in db with tickedAt), Z = zzz9 (only in db)
      const file = copyFixture("todo-open-only.md");
      const ops = plan(file, [dbRow("y002", { tickedAt: "2026-10-14T10:00:00Z" }), dbRow("zzz9")]);
      assert.deepEqual(
        ops.map((o) => [o.op, o.path]),
        [
          ["set", "todos/x001"],
          ["update", "todos/y002"],
          ["delete", "todos/zzz9"],
          ["set", "meta/sync"],
        ],
      );
      const update = ops[1].data;
      assert.ok(!("tickedAt" in update), "update never carries tickedAt");
      assert.equal(update.title, "Call the dentist");
      assert.equal(update.due, "2026-10-20");
      assert.equal(ops[2].data, undefined);
    },
  );

  it("REQ-008: archived items are not set or updated", pending("T-005"), () => {
    const file = copyFixture("todo-ids.md"); // zz90 is in ## Archive
    const ops = plan(file, [dbRow("zz90")]);
    const touched = ops.filter((o) => o.path === "todos/zz90");
    assert.ok(
      touched.every((o) => o.op === "delete"),
      JSON.stringify(touched),
    );
    assert.ok(
      ops.some((o) => o.path === "todos/p7q1" && o.op === "set"),
      "done items are pushed",
    );
  });

  it("REQ-008: accepts rows as {docs:[{id,data}]} too", pending("T-005"), () => {
    const file = copyFixture("todo-open-only.md");
    const rows = writeRows(file, {
      docs: [
        { id: "y002", data: { title: "x", status: "open", tickedAt: "2026-10-14T10:00:00Z" } },
      ],
    });
    const { ops } = runJson(["plan", "--file", file, "--rows", rows, "--now", NOW]);
    assert.deepEqual(
      ops.map((o) => [o.op, o.path]),
      [
        ["set", "todos/x001"],
        ["update", "todos/y002"],
        ["set", "meta/sync"],
      ],
    );
  });
});
