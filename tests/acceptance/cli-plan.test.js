// REQ-008: `todo-sync plan` outputs the db operations that make the db match the file.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOW, copyFixture, read, runJson, writeRows, writeText } from "../../test/cli-helpers.js";

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
  it("REQ-008: a new item becomes a set op, plus set meta/sync", {}, () => {
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
    {},
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

  it("REQ-008: archived items are not set or updated", {}, () => {
    const file = copyFixture("todo-ids.md"); // zz90 is in ## Archive
    const ops = plan(file, [dbRow("zz90")]);
    const touched = ops.filter((o) => o.path === "todos/zz90");
    assert.deepEqual(
      touched.map((o) => o.op),
      ["delete"],
      JSON.stringify(touched),
    );
    assert.ok(
      ops.some((o) => o.path === "todos/p7q1" && o.op === "set"),
      "done items are pushed",
    );
  });

  it("REQ-008: accepts rows as {docs:[{id,data}]} too", {}, () => {
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

  it(
    "REQ-008: a row with tickedAt whose item is done gets tickedAt null; an open item's row is untouched",
    {},
    () => {
      const file = copyFixture("todo-tick.md"); // p7q1 is done in the file
      const t = "2026-10-14T10:00:00Z";
      const ops = plan(file, [dbRow("p7q1", { status: "done", tickedAt: t })]);
      const done = ops.find((o) => o.path === "todos/p7q1");
      assert.equal(done.op, "update");
      assert.strictEqual(done.data.tickedAt, null);

      const open = copyFixture("todo-open-only.md"); // y002 is open
      const ops2 = plan(open, [dbRow("y002", { tickedAt: t })]);
      assert.ok(!("tickedAt" in ops2.find((o) => o.path === "todos/y002").data));
    },
  );

  it("REQ-008: tick, sync, reopen, next sync keeps the item open", {}, () => {
    const file = copyFixture("todo-open-only.md");
    const t = "2026-10-14T10:00:00Z";
    const rowsFile = (rows) => writeRows(file, rows);
    const applyArgs = (rows) => ["apply", "--file", file, "--rows", rowsFile(rows), "--now", NOW];
    // 1st sync: the page tick is applied, the plan consumes it.
    const first = runJson(applyArgs([dbRow("x001", { tickedAt: t }), dbRow("y002")]));
    assert.deepEqual(
      first.markedDone.map((m) => m.id),
      ["x001"],
    );
    const rows1 = [dbRow("x001", { tickedAt: t }), dbRow("y002")];
    const planned = plan(file, rows1).find((o) => o.path === "todos/x001");
    assert.strictEqual(planned.data.tickedAt, null);
    // db after the batch: row merged with the update data.
    const rows2 = [{ ...rows1[0], ...planned.data }, dbRow("y002")];
    // Martin reopens the line in TODO.md.
    const text = read(file).replace(/- \[x\] Pay invoice \(done [^)]*\)/, "- [ ] Pay invoice");
    assert.ok(text.includes("- [ ] Pay invoice <!-- id:x001 -->"));
    writeText(file, text);
    // 2nd sync: nothing is re-ticked, the plan pushes it as open.
    const second = runJson(applyArgs(rows2));
    assert.deepEqual(second.markedDone, []);
    assert.deepEqual(second.skipped, []);
    assert.equal(read(file), text);
    const pushed = plan(file, rows2).find((o) => o.path === "todos/x001");
    assert.equal(pushed.data.status, "open");
    assert.ok(pushed.data.tickedAt == null);
  });
});
