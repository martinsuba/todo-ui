import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTodo } from "../../src/sync/parse.js";
import { planOps } from "../../src/sync/plan.js";

const now = new Date("2026-10-14T12:00:00Z");

describe("planOps", () => {
  it("sets open items in file order plus meta/sync, skipping id-less items with a warning", () => {
    const { items } = parseTodo(
      "- [ ] A <!-- id:aaa1 -->\n- [ ] B\n- [ ] C (due 2026-10-20) <!-- id:ccc3 -->\n- [x] D <!-- id:ddd4 -->\n",
    );
    const warnings = [];
    const { ops } = planOps(items, { now, warn: (m) => warnings.push(m) });
    assert.deepEqual(
      ops.map((o) => [o.op, o.path]),
      [
        ["set", "todos/aaa1"],
        ["set", "todos/ccc3"],
        ["set", "todos/ddd4"],
        ["set", "meta/sync"],
      ],
    );
    assert.ok(ops[0].data?.order < ops[1].data?.order);
    assert.equal(ops[1].data?.due, "2026-10-20");
    assert.equal(ops[2].data?.status, "done");
    assert.deepEqual(ops[3].data, { syncedAt: "2026-10-14T12:00:00.000Z" });
    assert.equal(warnings.length, 1);
  });

  it("plans done items with doneAt and never archived items", () => {
    const { items } = parseTodo(
      "## Done\n- [x] Fix (done 2026-10-14) → [details](f.md) <!-- id:fx11 -->\n## Archive\n- [x] Old (done 2026-10-01) <!-- id:zz90 -->\n",
    );
    const { ops } = planOps(items, { now });
    assert.deepEqual(
      ops.map((o) => o.path),
      ["todos/fx11", "meta/sync"],
    );
    assert.deepEqual(ops[0].data, {
      title: "Fix",
      due: null,
      meta: "details: f.md",
      status: "done",
      doneAt: "2026-10-14",
      order: 0,
    });
  });

  it("warns on stderr hook when a due part stays in the title", () => {
    const { items } = parseTodo("- [ ] Call (due 2026-11-01, call back) <!-- id:w001 -->\n");
    const warnings = [];
    planOps(items, { now, warn: (m) => warnings.push(m) });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Call/);
    assert.match(warnings[0], /due 2026-11-01/);
  });
});

describe("planOps with db rows", () => {
  it("updates rows present, sets new, deletes rows not in Open/Done, never tickedAt", () => {
    const { items } = parseTodo(
      "## Open\n- [ ] A <!-- id:aaa1 -->\n- [ ] B <!-- id:bbb2 -->\n## Archive\n- [x] Z (done 2026-01-01) <!-- id:zzz9 -->\n",
    );
    const { ops } = planOps(items, {
      now,
      rows: [{ id: "bbb2", tickedAt: "2026-10-14T10:00:00Z" }, { id: "zzz9" }, { id: "gone" }],
    });
    assert.deepEqual(
      ops.map((o) => [o.op, o.path]),
      [
        ["set", "todos/aaa1"],
        ["update", "todos/bbb2"],
        ["delete", "todos/zzz9"],
        ["delete", "todos/gone"],
        ["set", "meta/sync"],
      ],
    );
    assert.ok(!("tickedAt" in (ops[1].data ?? {})));
  });
});

describe("planOps duplicate ids", () => {
  it("emits no op for an id on several lines and warns", () => {
    const { items } = parseTodo(
      "- [ ] A <!-- id:aaaa -->\n- [ ] B <!-- id:aaaa -->\n- [ ] C <!-- id:cccc -->\n",
    );
    const warnings = [];
    const { ops } = planOps(items, { now, rows: [{ id: "aaaa" }], warn: (m) => warnings.push(m) });
    assert.deepEqual(
      ops.map((o) => o.path),
      ["todos/cccc", "meta/sync"],
    );
    assert.equal(warnings.length, 1);
  });

  it("clears tickedAt only on rows whose item is done (D-007)", () => {
    const { items } = parseTodo(
      "- [ ] A <!-- id:aaa1 -->\n- [x] B (done 2026-10-14) <!-- id:bbb2 -->\n- [x] C (done 2026-10-14) <!-- id:ccc3 -->\n- [x] D (done 2026-10-14) <!-- id:ddd4 -->\n",
    );
    const t = "2026-10-14T10:00:00Z";
    const rows = [
      { id: "aaa1", tickedAt: t },
      { id: "bbb2", tickedAt: t },
      { id: "ccc3", tickedAt: null },
      { id: "ddd4" },
    ];
    const { ops } = planOps(items, { now, rows });
    const data = (id) => ops.find((o) => o.path === `todos/${id}`)?.data ?? {};
    assert.ok(!("tickedAt" in data("aaa1")));
    assert.strictEqual(data("bbb2").tickedAt, null);
    assert.ok(!("tickedAt" in data("ccc3")));
    assert.ok(!("tickedAt" in data("ddd4")));
  });

  it("a done item without a db row gets set without tickedAt", () => {
    const { items } = parseTodo("- [x] B (done 2026-10-14) <!-- id:bbb2 -->\n");
    const { ops } = planOps(items, { now });
    assert.ok(!("tickedAt" in (ops[0].data ?? {})));
  });
});
