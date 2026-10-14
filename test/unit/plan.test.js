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
        ["set", "meta/sync"],
      ],
    );
    assert.ok(ops[0].data?.order < ops[1].data?.order);
    assert.equal(ops[1].data?.due, "2026-10-20");
    assert.deepEqual(ops[2].data, { syncedAt: "2026-10-14T12:00:00.000Z" });
    assert.equal(warnings.length, 1);
  });
});
