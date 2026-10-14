import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moveLineToSection, replaceLine, serialize } from "../../src/sync/write.js";

const L = (s) => s.split("\n");

describe("replaceLine", () => {
  it("replaces one line and leaves the input untouched", () => {
    const lines = L("a\nb\nc\n");
    const out = replaceLine(lines, 1, "B");
    assert.equal(serialize(out), "a\nB\nc\n");
    assert.equal(serialize(lines), "a\nb\nc\n");
  });
  it("rejects out-of-range indexes", () => {
    assert.throws(() => replaceLine(L("a"), 5, "x"), RangeError);
  });
});

describe("moveLineToSection", () => {
  it("moves to the end of an existing section, before trailing blank lines", () => {
    const text = "## Open\n- a\n- b\n\n## Done\n- c\n\n## Archive\n- d\n";
    const r = moveLineToSection(L(text), 1, "Done");
    assert.equal(serialize(r.lines), "## Open\n- b\n\n## Done\n- c\n- a\n\n## Archive\n- d\n");
    assert.equal(r.lines[r.index], "- a");
  });
  it("moves into an empty section", () => {
    const r = moveLineToSection(L("## Open\n- a\n\n## Done\n"), 1, "Done");
    assert.equal(serialize(r.lines), "## Open\n\n## Done\n- a\n");
  });
  it("moves into the last section without trailing newline", () => {
    const r = moveLineToSection(L("## Open\n- a\n## Done\n- c"), 1, "Done");
    assert.equal(serialize(r.lines), "## Open\n## Done\n- c\n- a");
  });
  it("creates a missing section at file end", () => {
    const r = moveLineToSection(L("## Open\n- a\n- b\n"), 1, "Archive");
    assert.equal(serialize(r.lines), "## Open\n- b\n\n## Archive\n- a\n");
    assert.equal(r.lines[r.index], "- a");
  });
  it("creates a missing section when the file has no trailing newline", () => {
    const r = moveLineToSection(L("## Open\n- a\n- b"), 2, "Done");
    assert.equal(serialize(r.lines), "## Open\n- a\n\n## Done\n- b");
  });
});
