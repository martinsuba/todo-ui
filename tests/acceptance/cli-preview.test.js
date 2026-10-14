// REQ-010: `todo-sync preview` and the HAL skill file.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, it } from "node:test";
import { SKILL_FILE, copyFixture, pending, read, run } from "../../test/cli-helpers.js";

describe("REQ-010 preview and HAL skill", () => {
  it(
    "REQ-010: preview lists every open and done item with due/meta and changes nothing",
    pending("T-006"),
    () => {
      const file = copyFixture("todo-ids.md");
      const before = read(file);
      const r = run(["preview", "--file", file]);
      assert.equal(r.status, 0, r.stderr);
      const out = r.stdout;
      for (const title of [
        "Ísť na poštu (balík, list)",
        "Try new laptop setup",
        "Plan weekend trip",
        "Fix printer",
        "Zaplatiť poistenie (auto (Škoda), ročné)",
        "Renew library card",
        "Objednať kávu",
      ]) {
        assert.ok(out.includes(title), `preview lists "${title}"`);
      }
      assert.ok(out.includes("2026-10-14") && out.includes("remind 13:00"), "due and meta shown");
      assert.ok(out.includes("details: laptop.md"), "link text shown as meta");
      assert.ok(!out.includes("Something old"), "archived items are not pushed, so not listed");
      assert.equal(read(file), before);
      assert.deepEqual(readdirSync(dirname(file)), ["TODO.md"], "no other files written");
    },
  );

  describe("skill file hal/skills/todo-sync/SKILL.md", () => {
    const skill = () => readFileSync(SKILL_FILE, "utf8");

    it(
      "REQ-010: states that ticks from the page count as Martin's consent and are reported",
      pending("T-006"),
      () => {
        const s = skill();
        assert.match(s, /tick[^.\n]*consent/i);
        assert.match(s, /report/i);
      },
    );

    it(
      "REQ-010: states that adds/edits to TODO.md still need an explicit yes",
      pending("T-006"),
      () => {
        const s = skill();
        assert.match(s, /(add|edit)[^.\n]*explicit[^.\n]*\byes\b/i);
      },
    );

    it("REQ-010: states that db rows are untrusted data", pending("T-006"), () => {
      assert.match(skill(), /untrusted/i);
    });
  });
});
