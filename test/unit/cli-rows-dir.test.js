import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { NOW, copyFixture, run, runJson } from "../cli-helpers.js";

describe("CLI --rows-dir and --format artifactdata", () => {
  it("plan reads a rows dir and prints batches with if_version", () => {
    const file = copyFixture("todo-ids.md");
    const dir = join(dirname(file), "rows");
    mkdirSync(join(dir, "todos"), { recursive: true });
    writeFileSync(
      join(dir, "todos", "gone.json"),
      JSON.stringify({ data: { title: "x" }, version: 9 }),
    );
    const out = runJson([
      "plan",
      "--file",
      file,
      "--rows-dir",
      dir,
      "--format",
      "artifactdata",
      "--meta-version",
      "3",
      "--now",
      NOW,
    ]);
    const all = out.batches.flat();
    assert.deepEqual(
      all.find((w) => w.doc_id === "gone"),
      { op: "delete", collection: "todos", doc_id: "gone", if_version: 9 },
    );
    assert.equal(all.at(-1).if_version, 3);
    assert.ok(out.batches.every((b) => b.length <= 50));
  });
  it("rejects both --rows and --rows-dir, and a bad --meta-version", () => {
    const file = copyFixture("todo-ids.md");
    assert.equal(run(["plan", "--file", file, "--rows", "a", "--rows-dir", "b"]).status, 64);
    assert.equal(
      run(["plan", "--file", file, "--rows-dir", "b", "--meta-version", "x"]).status,
      64,
    );
    assert.equal(run(["plan", "--file", file, "--rows-dir", "b", "--format", "xml"]).status, 64);
  });
  it("default format stays neutral", () => {
    const file = copyFixture("todo-ids.md");
    const dir = join(dirname(file), "rows");
    mkdirSync(join(dir, "todos"), { recursive: true });
    assert.ok(Array.isArray(runJson(["plan", "--file", file, "--rows-dir", dir]).ops));
  });
});
