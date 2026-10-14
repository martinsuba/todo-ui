import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeRows, validateRows } from "../../src/sync/rows.js";

describe("rows", () => {
  it("normalises both formats", () => {
    assert.deepEqual(normalizeRows([{ id: "a" }]), [{ id: "a" }]);
    assert.deepEqual(normalizeRows({ docs: [{ id: "abcd", data: { t: 1 } }] }), [
      { t: 1, id: "abcd" },
    ]);
    assert.throws(() => normalizeRows({ nope: 1 }));
    assert.throws(() => normalizeRows("x"));
  });
  it("validates id, tickedAt and object-ness", () => {
    const { rows, skipped } = validateRows([
      { id: "abcd", tickedAt: "2026-10-14T10:00:00Z" },
      { id: "ABCD" },
      { id: "abcd1", tickedAt: "nope" },
      { id: "abcd2", tickedAt: 5 },
      [],
      7,
      { id: "abcd3" },
    ]);
    assert.deepEqual(
      rows.map((r) => r.id),
      ["abcd", "abcd3"],
    );
    assert.equal(skipped.length, 5);
  });
});

describe("rows for plan", () => {
  it("checkTickedAt:false keeps rows with a bad tickedAt", () => {
    const { rows, skipped } = validateRows([{ id: "abcd", tickedAt: "nope" }], {
      checkTickedAt: false,
    });
    assert.equal(rows.length, 1);
    assert.equal(skipped.length, 0);
  });
});
