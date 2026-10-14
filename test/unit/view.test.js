import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  doneDate,
  doneWindow,
  dueState,
  isDone,
  localDate,
  sortOpen,
} from "../../src/page/view.js";

const row = (id, f = {}, order = 0) => ({ id, status: "open", due: null, order, ...f });

test("sortOpen: due ascending, undated last, ties by order", () => {
  const rows = [
    row("a", { due: "2026-10-20" }, 0),
    row("b", {}, 1),
    row("c", { due: "2026-10-15" }, 2),
    row("d", { due: "2026-10-15" }, 1.5),
    row("e", {}, 0.5),
  ];
  assert.deepEqual(
    sortOpen(rows).map((r) => r.id),
    ["d", "c", "a", "e", "b"],
  );
});

test("sortOpen: excludes done and ticked, ignores invalid due, does not mutate input", () => {
  const rows = [
    row("a", { status: "done" }),
    row("b", { tickedAt: "2026-10-14T10:00:00Z" }),
    row("c", { due: "garbage" }, 1),
    row("d", { due: "2026-10-01" }, 2),
  ];
  const copy = rows.slice();
  assert.deepEqual(
    sortOpen(rows).map((r) => r.id),
    ["d", "c"],
  );
  assert.deepEqual(rows, copy);
});

test("dueState with injected today", () => {
  assert.equal(dueState({ due: "2026-10-13" }, "2026-10-14"), "overdue");
  assert.equal(dueState({ due: "2026-10-14" }, "2026-10-14"), "today");
  assert.equal(dueState({ due: "2026-10-15" }, "2026-10-14"), "none");
  assert.equal(dueState({ due: null }, "2026-10-14"), "none");
  assert.equal(dueState({}, "2026-10-14"), "none");
});

test("localDate uses local fields, not UTC", () => {
  assert.equal(localDate(new Date(2026, 9, 14, 0, 30)), "2026-10-14");
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-10-14", -7), "2026-10-07");
  assert.equal(addDays("2026-01-03", -7), "2025-12-27");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("isDone / doneDate", () => {
  assert.equal(isDone({ status: "done" }), true);
  assert.equal(isDone({ status: "open", tickedAt: "2026-10-14T10:00:00Z" }), true);
  assert.equal(isDone({ status: "open" }), false);
  assert.equal(doneDate({ doneAt: "2026-10-12", tickedAt: "2026-10-14T10:00:00Z" }), "2026-10-12");
  const t = new Date(2026, 9, 14, 0, 30);
  assert.equal(doneDate({ tickedAt: t.toISOString() }), "2026-10-14");
  assert.equal(doneDate({ status: "done" }), null);
});

test("doneWindow: newest first, hides items older than 7 days, keeps exactly 7", () => {
  const rows = [
    row("old", { status: "done", doneAt: "2026-10-06" }),
    row("edge", { status: "done", doneAt: "2026-10-07" }, 1),
    row("new", { status: "done", doneAt: "2026-10-13" }, 2),
    row("open", {}, 3),
    row("nodate", { status: "done" }, 4),
  ];
  assert.deepEqual(
    doneWindow(rows, "2026-10-14").map((r) => r.id),
    ["new", "edge", "nodate"],
  );
});
