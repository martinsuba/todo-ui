import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { applyFile, applyTodo } from "../../src/sync/apply.js";

const now = new Date("2026-10-14T12:00:00Z");
const tick = (id, at = "2026-10-14T10:00:00Z") => ({ id, tickedAt: at });
/** @param {string} text @param {unknown} [rows] @param {object} [extra] */
const run = (text, rows = [], extra = {}) => applyTodo(text, rows, { now, ...extra });

describe("applyTodo ticks", () => {
  it("keeps the due group, puts done before link and id (option A)", () => {
    const t =
      "## Open\n- [ ] Fix (due 2026-10-20, remind 09:00) → [details](f.md) <!-- id:aa11 -->\n\n## Done\n- [x] Old (done 2026-10-13) <!-- id:bb22 -->\n";
    const r = run(t, [tick("aa11")]);
    assert.equal(
      r.text,
      "## Open\n\n## Done\n- [x] Fix (due 2026-10-20, remind 09:00) (done 2026-10-14) → [details](f.md) <!-- id:aa11 -->\n- [x] Old (done 2026-10-13) <!-- id:bb22 -->\n",
    );
    assert.deepEqual(r.summary.markedDone, [{ id: "aa11", title: "Fix" }]);
  });

  it("creates ## Done at the end when missing", () => {
    const r = run("## Open\n- [ ] A <!-- id:aa11 -->\n", [tick("aa11")]);
    assert.equal(r.text, "## Open\n\n## Done\n- [x] A (done 2026-10-14) <!-- id:aa11 -->\n");
  });

  it("creates ## Done before ## Archive", () => {
    const t =
      "## Open\n- [ ] A <!-- id:aa11 -->\n\n## Archive\n- [x] Z (done 2026-01-01) <!-- id:zz11 -->\n";
    const r = run(t, [tick("aa11")]);
    assert.equal(
      r.text,
      "## Open\n\n## Done\n- [x] A (done 2026-10-14) <!-- id:aa11 -->\n\n## Archive\n- [x] Z (done 2026-01-01) <!-- id:zz11 -->\n",
    );
  });

  it("uses the local date of tickedAt", () => {
    const r = run("- [ ] A <!-- id:aa11 -->\n", [tick("aa11", "2026-10-14T10:00:00+02:00")]);
    assert.match(r.text, /\(done 2026-10-1[34]\)/);
  });

  it("skips invalid, unknown and already-done rows", () => {
    const t = "- [ ] A <!-- id:aa11 -->\n- [x] B (done 2026-10-13) <!-- id:bb22 -->\n";
    const r = run(t, [
      tick("bb22"),
      tick("zz99"),
      tick("A!"),
      { id: "aa11", tickedAt: "garbage" },
      "str",
      null,
    ]);
    assert.equal(r.text, t);
    assert.deepEqual(r.summary.markedDone, []);
    assert.equal(r.summary.skipped.length, 6);
    assert.ok(r.summary.skipped.every((s) => typeof s.reason === "string"));
  });

  it("ignores rows without tickedAt", () => {
    const t = "- [ ] A <!-- id:aa11 -->\n";
    const r = run(t, [{ id: "aa11", status: "open" }]);
    assert.equal(r.text, t);
    assert.deepEqual(r.summary.skipped, []);
  });

  it("accepts {docs:[{id,data}]}", () => {
    const r = run("- [ ] A <!-- id:aa11 -->\n", {
      docs: [{ id: "aa11", data: { tickedAt: "2026-10-14T10:00:00Z" } }],
    });
    assert.equal(r.summary.markedDone.length, 1);
  });
});

describe("applyTodo archive", () => {
  const doc = (d) => `## Done\n- [x] A (done ${d}) <!-- id:aa11 -->\n`;
  it("exactly 7 days stays, 8 days moves", () => {
    assert.equal(run(doc("2026-10-07")).text, doc("2026-10-07"));
    const r = run(doc("2026-10-06"));
    assert.equal(r.text, "## Done\n\n## Archive\n- [x] A (done 2026-10-06) <!-- id:aa11 -->\n");
    assert.deepEqual(r.summary.archived, [{ id: "aa11", title: "A" }]);
  });
  it("appends to an existing Archive", () => {
    const t =
      "## Done\n- [x] A (done 2026-09-01) <!-- id:aa11 -->\n\n## Archive\n- [x] Z (done 2026-01-01) <!-- id:zz11 -->\n";
    assert.equal(
      run(t).text,
      "## Done\n\n## Archive\n- [x] Z (done 2026-01-01) <!-- id:zz11 -->\n- [x] A (done 2026-09-01) <!-- id:aa11 -->\n",
    );
  });
  it("never moves done items without a done date", () => {
    const t = "## Done\n- [x] A <!-- id:aa11 -->\n";
    assert.equal(run(t).text, t);
  });
});

describe("applyTodo ids and formatting", () => {
  it("adds unique ids with an injectable rng, only once", () => {
    const seq = [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5];
    let i = 0;
    const t = "- [ ] A <!-- id:aaaa -->\n- [ ] B\n- [ ] C\n";
    const r = run(t, [], { rng: () => seq[i++] });
    // first candidate "aaaa" collides with the existing id, so B gets "iiii" at the second draw
    assert.match(r.text, /- \[ \] B <!-- id:(\w{4}) -->/);
    assert.equal(r.summary.idsAdded, 2);
    const ids = [...r.text.matchAll(/id:(\w+)/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, 3);
    assert.equal(run(r.text).summary.idsAdded, 0);
  });

  it("CRLF files stay CRLF", () => {
    const t = "## Open\r\n- [ ] A <!-- id:aa11 -->\r\n- [ ] B\r\n";
    const r = run(t, [tick("aa11")], { rng: () => 0.1 });
    assert.ok(!/[^\r]\n/.test(r.text), JSON.stringify(r.text));
    assert.equal(
      r.text,
      "## Open\r\n- [ ] B <!-- id:3333 -->\r\n\r\n## Done\r\n- [x] A (done 2026-10-14) <!-- id:aa11 -->\r\n",
    );
  });

  it("keeps a missing trailing newline", () => {
    const t = "## Open\n- [ ] A <!-- id:aa11 -->\n- [ ] B <!-- id:bb22 -->";
    assert.equal(run(t).text, t);
    const r = run(t, [tick("bb22")]);
    assert.equal(
      r.text,
      "## Open\n- [ ] A <!-- id:aa11 -->\n\n## Done\n- [x] B (done 2026-10-14) <!-- id:bb22 -->",
    );
    assert.equal(run("- [ ] A", [], { rng: () => 0 }).text, "- [ ] A <!-- id:0000 -->");
  });

  it("leaves a file with no items byte-identical", () => {
    assert.equal(run("").text, "");
    assert.equal(run("# TODO\n\nnotes\n").text, "# TODO\n\nnotes\n");
  });
});

describe("applyFile", () => {
  const setup = (text) => {
    const dir = mkdtempSync(join(tmpdir(), "apply-unit-"));
    const file = join(dir, "TODO.md");
    writeFileSync(file, text);
    return { dir, file };
  };
  const T = "## Open\n- [ ] A <!-- id:aa11 -->\n";

  it("writes and leaves no temp file behind", () => {
    const { dir, file } = setup(T);
    applyFile(file, [tick("aa11")], { now });
    assert.match(readFileSync(file, "utf8"), /\[x\] A/);
    assert.deepEqual(readdirSync(dir), ["TODO.md"]);
  });

  it("dry-run never writes", () => {
    const { file } = setup(T);
    const s = applyFile(file, [tick("aa11")], { now, dryRun: true });
    assert.equal(s.markedDone.length, 1);
    assert.equal(readFileSync(file, "utf8"), T);
  });

  it("aborts without writing when the file changed meanwhile", () => {
    const { dir, file } = setup(T);
    assert.throws(
      () =>
        applyFile(file, [tick("aa11")], {
          now,
          beforeCommit: () => writeFileSync(file, T + "- [ ] new\n"),
        }),
      /changed while syncing/,
    );
    assert.equal(readFileSync(file, "utf8"), T + "- [ ] new\n");
    assert.deepEqual(readdirSync(dir), ["TODO.md"]);
  });
});
