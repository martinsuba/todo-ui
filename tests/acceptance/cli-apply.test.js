// REQ-009: `todo-sync apply` writes ticks from db rows into TODO.md and archives old done items.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOW, copyFixture, pending, read, runJson, writeRows } from "../../test/cli-helpers.js";

const row = (id, extra = {}) => ({ id, status: "open", ...extra });
const skippedIds = (summary) => summary.skipped.map((s) => (typeof s === "string" ? s : s.id));

describe("REQ-009 apply: pull ticks and archive", () => {
  it(
    "REQ-009: a ticked open item becomes [x] (done date) at the top of ## Done",
    pending("T-005"),
    () => {
      const file = copyFixture("todo-tick.md");
      const rows = writeRows(file, [row("x001", { tickedAt: "2026-10-14T10:00:00Z" })]);
      const summary = runJson(["apply", "--file", file, "--rows", rows, "--now", NOW]);
      assert.deepEqual(summary.markedDone, [{ id: "x001", title: "Pay invoice" }]);
      assert.equal(
        read(file),
        [
          "# TODO",
          "",
          "## Open",
          "- [ ] Call the dentist (due 2026-10-20) <!-- id:y002 -->",
          "",
          "## Done",
          "- [x] Pay invoice (done 2026-10-14) <!-- id:x001 -->",
          "- [x] Renew library card (done 2026-10-13) <!-- id:p7q1 -->",
          "",
        ].join("\n"),
      );
    },
  );

  it("REQ-009: done items older than 7 days move to ## Archive", pending("T-005"), () => {
    const file = copyFixture("todo-old-done.md"); // dn02 done 2026-10-01, dn01 done 2026-10-13
    const summary = runJson(["apply", "--file", file, "--rows", writeRows(file, []), "--now", NOW]);
    assert.deepEqual(
      summary.archived.map((a) => a.id),
      ["dn02"],
    );
    const text = read(file);
    const archiveAt = text.indexOf("## Archive");
    assert.ok(archiveAt > 0, "Archive section created");
    assert.ok(text.indexOf("id:dn02") > archiveAt, "dn02 is under ## Archive");
    assert.ok(text.indexOf("id:dn01") < archiveAt, "dn01 stays in ## Done");
    assert.ok(text.indexOf("id:dn01") > text.indexOf("## Done"));
    assert.equal((text.match(/^## /gm) || []).length, 3, "Open, Done, Archive: Archive is last");
    assert.ok(text.lastIndexOf("## ") === archiveAt, "Archive is the last section");
  });

  it(
    "REQ-009: ticks for already-done or unknown items are skipped and the file is unchanged for them",
    pending("T-005"),
    () => {
      const file = copyFixture("todo-ids.md");
      const before = read(file);
      const rows = writeRows(file, [
        row("p7q1", { status: "done", tickedAt: "2026-10-14T10:00:00Z" }), // already done in the file
        row("gone", { tickedAt: "2026-10-14T10:00:00Z" }), // not in the file
      ]);
      const summary = runJson(["apply", "--file", file, "--rows", rows, "--now", NOW]);
      assert.deepEqual(summary.markedDone, []);
      assert.deepEqual(skippedIds(summary).sort(), ["gone", "p7q1"]);
      assert.equal(read(file), before);
    },
  );

  it(
    "REQ-009: --dry-run leaves the file untouched and prints the summary",
    pending("T-005"),
    () => {
      const file = copyFixture("todo-open-only.md");
      const before = read(file);
      const rows = writeRows(file, [row("x001", { tickedAt: "2026-10-14T10:00:00Z" })]);
      const summary = runJson(["apply", "--file", file, "--rows", rows, "--now", NOW, "--dry-run"]);
      assert.deepEqual(summary.markedDone, [{ id: "x001", title: "Pay invoice" }]);
      assert.equal(read(file), before);
    },
  );
});
