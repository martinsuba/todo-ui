import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

/** Load test/fake-claude.js into a fresh fake `window`. */
function load(config) {
  const window = { __FAKE_CLAUDE_CONFIG: config };
  runInNewContext(readFileSync(new URL("../fake-claude.js", import.meta.url), "utf8"), {
    window,
    queueMicrotask,
    JSON,
    Object,
    Promise,
    Map,
    Set,
    Array,
    Math,
    TypeError,
    String,
  });
  return window;
}

const row = { title: "A", due: null, meta: null, status: "open", doneAt: null, order: 0 };

test("use('db') resolves the db, or null when configured", async () => {
  assert.ok(await load({}).claude.use("db"));
  assert.equal(await load({ dbNull: true }).claude.use("db"), null);
  assert.equal(await load({}).claude.use("nope"), null);
});

test("seeded docs are readable; missing docs have exists false", async () => {
  const w = load({ seed: { "todos/a1": row } });
  const db = await w.claude.use("db");
  const snap = await db.doc("todos/a1").get();
  assert.equal(snap.exists, true);
  assert.equal(snap.id, "a1");
  assert.equal(snap.data().title, "A");
  assert.equal((await db.doc("todos/zz").get()).exists, false);
});

test("set/update/delete are recorded; update merges and requires existence", async () => {
  const w = load({ seed: { "todos/a1": row } });
  const db = await w.claude.use("db");
  await db.doc("todos/a1").update({ tickedAt: "2026-10-14T10:00:00Z" });
  assert.deepEqual(w.__fakeClaude.dump()["todos/a1"].title, "A");
  assert.equal(w.__fakeClaude.dump()["todos/a1"].tickedAt, "2026-10-14T10:00:00Z");
  await assert.rejects(db.doc("todos/none").update({ x: 1 }), { code: "invalid_argument" });
  await db.doc("todos/a1").delete();
  assert.equal(w.__fakeClaude.writes.length, 2);
  assert.equal(w.__fakeClaude.attempts.length, 3);
});

test("failWrites rejects and records only an attempt", async () => {
  const w = load({ seed: { "todos/a1": row }, failWrites: true });
  const db = await w.claude.use("db");
  await assert.rejects(db.doc("todos/a1").update({ tickedAt: "x" }), { code: "unavailable" });
  assert.equal(w.__fakeClaude.attempts.length, 1);
  assert.equal(w.__fakeClaude.writes.length, 0);
  w.__fakeClaude.failWrites = false;
  await db.doc("todos/a1").update({ tickedAt: "x" });
  assert.equal(w.__fakeClaude.writes.length, 1);
});

test("collection onSnapshot delivers docs, then updates on external changes", async () => {
  const w = load({ seed: { "todos/a1": row, "meta/sync": { syncedAt: "x" } } });
  const db = await w.claude.use("db");
  const sizes = [];
  const off = db.collection("todos").onSnapshot((snap) => sizes.push(snap.docs.map((d) => d.id)));
  await Promise.resolve();
  w.__fakeClaude.externalSet("todos/b2", row);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(JSON.stringify(sizes), JSON.stringify([["a1"], ["a1", "b2"]]));
  off();
  assert.equal(w.__fakeClaude.subscriptions, 0);
});

test("bad paths throw TypeError", async () => {
  const db = await load({}).claude.use("db");
  assert.throws(() => db.doc("todos"), TypeError);
  assert.throws(() => db.collection("todos/a1"), TypeError);
});
