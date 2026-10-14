import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
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

describe("applyTodo review fixes", () => {
  it("moves child lines with their item (tick and archive)", () => {
    const t = [
      "## Open",
      "- [ ] A <!-- id:aaaa -->",
      "  - note a",
      "\t- tab note",
      "- [ ] B <!-- id:bbbb -->",
      "",
      "## Done",
      "- [x] Old (done 2026-09-01) <!-- id:oooo -->",
      "  - old note",
      "",
    ].join("\n");
    const r = run(t, [tick("aaaa")]);
    assert.equal(
      r.text,
      [
        "## Open",
        "- [ ] B <!-- id:bbbb -->",
        "",
        "## Done",
        "- [x] A (done 2026-10-14) <!-- id:aaaa -->",
        "  - note a",
        "\t- tab note",
        "",
        "## Archive",
        "- [x] Old (done 2026-09-01) <!-- id:oooo -->",
        "  - old note",
        "",
      ].join("\n"),
    );
  });

  it("a block stops at a blank line", () => {
    const r = run("- [ ] A <!-- id:aaaa -->\n  c\n\n  stray\n", [tick("aaaa")]);
    assert.equal(r.text, "\n  stray\n\n## Done\n- [x] A (done 2026-10-14) <!-- id:aaaa -->\n  c\n");
  });

  it("skips a tick for an id on several lines", () => {
    const t = "- [ ] A <!-- id:aaaa -->\n- [ ] B <!-- id:aaaa -->\n";
    const r = run(t, [tick("aaaa")]);
    assert.equal(r.text, t);
    assert.deepEqual(r.summary.skipped, [{ id: "aaaa", reason: "ambiguous id" }]);
  });

  it("ignores items inside fenced code blocks", () => {
    const t =
      "## Open\n```\n- [ ] in fence\n```\n~~~\n- [ ] tilde <!-- id:aaaa -->\n~~~\n- [ ] real\n";
    const r = run(t, [tick("aaaa")], { rng: () => 0 });
    assert.equal(
      r.text,
      "## Open\n```\n- [ ] in fence\n```\n~~~\n- [ ] tilde <!-- id:aaaa -->\n~~~\n- [ ] real <!-- id:0000 -->\n",
    );
    assert.equal(r.summary.skipped[0].reason, "not in file");
  });

  it("date-only tickedAt is that calendar date", () => {
    const r = run("- [ ] A <!-- id:aaaa -->\n", [tick("aaaa", "2026-10-14")]);
    assert.match(r.text, /\(done 2026-10-14\)/);
  });

  it("an edited line keeps its own line ending in a mixed file", () => {
    let n = 0;
    const r = run("- [ ] A <!-- id:aaaa -->\n- [ ] B\r\n- [ ] C\n", [], {
      rng: () => (n++ % 37) / 37,
    });
    assert.match(
      r.text,
      /^- \[ \] A <!-- id:aaaa -->\n- \[ \] B <!-- id:\w{4} -->\r\n- \[ \] C <!-- id:\w{4} -->\n$/,
    );
  });

  it("keeps a BOM", () => {
    const t = "\uFEFF## Open\n- [ ] A <!-- id:aaaa -->\n";
    assert.equal(run(t).text, t);
    assert.match(run(t, [tick("aaaa")]).text, /^\uFEFF## Open/);
  });
});

describe("applyFile encoding and temp file", () => {
  it("refuses a non-UTF-8 file and leaves it untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "apply-unit-"));
    const file = join(dir, "TODO.md");
    const bytes = Buffer.from([0x2d, 0x20, 0x5b, 0x20, 0x5d, 0x20, 0xe9, 0x0a]);
    writeFileSync(file, bytes);
    assert.throws(() => applyFile(file, [], { now }), /not valid UTF-8/);
    assert.ok(readFileSync(file).equals(bytes));
  });

  it("does not follow a pre-planted temp symlink", () => {
    const dir = mkdtempSync(join(tmpdir(), "apply-unit-"));
    const file = join(dir, "TODO.md");
    writeFileSync(file, "- [ ] A <!-- id:aaaa -->\n");
    const victim = join(dir, "victim");
    writeFileSync(victim, "keep");
    const orig = Date.now;
    Date.now = () => 42;
    try {
      symlinkSync(victim, join(dir, `.TODO.md.${process.pid}.42.tmp`));
      assert.throws(() => applyFile(file, [tick("aaaa")], { now }));
      assert.equal(readFileSync(victim, "utf8"), "keep");
    } finally {
      Date.now = orig;
    }
  });
});
