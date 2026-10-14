import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseTodo } from "../../src/sync/parse.js";
import { serialize } from "../../src/sync/write.js";

const fixture = (n) => readFileSync(new URL(`../fixtures/${n}`, import.meta.url), "utf8");

describe("parseTodo", () => {
  it("parses open and done checkbox lines with ids, due and sections", () => {
    const { items, lines } = parseTodo(
      "# TODO\n\n## Open\n- [ ] Pay (x) (due 2026-10-20) <!-- id:ab12 -->\n- [ ] No id\nplain\n## Done\n- [x] Old (done 2026-10-01) <!-- id:cd34 -->\n",
    );
    assert.equal(lines.length, 9);
    assert.deepEqual(items, [
      {
        line: 3,
        id: "ab12",
        title: "Pay (x)",
        due: "2026-10-20",
        doneAt: null,
        meta: null,
        status: "open",
        section: "Open",
        order: 0,
      },
      {
        line: 4,
        id: null,
        title: "No id",
        due: null,
        doneAt: null,
        meta: null,
        status: "open",
        section: "Open",
        order: 1,
      },
      {
        line: 7,
        id: "cd34",
        title: "Old",
        due: null,
        doneAt: "2026-10-01",
        meta: null,
        status: "done",
        section: "Done",
        order: 2,
      },
    ]);
  });

  it("handles CRLF and non-ASCII titles", () => {
    const { items } = parseTodo("- [ ] Ísť na poštu <!-- id:k3f9 -->\r\n");
    assert.equal(items[0].title, "Ísť na poštu");
    assert.equal(items[0].id, "k3f9");
    assert.equal(items[0].section, null);
  });

  it("parses the edge fixture", () => {
    const by = Object.fromEntries(parseTodo(fixture("todo-edge.md")).items.map((i) => [i.id, i]));
    assert.equal(by.e001.title, "Call (mum (and dad))");
    assert.equal(by.e001.due, "2026-11-01");
    assert.equal(by.e001.meta, "remind 09:00");
    assert.equal(by.e002.title, "Keep (due soon) as title");
    assert.equal(by.e002.due, null);
    assert.equal(by.e003.title, "Two groups");
    assert.equal(by.e003.meta, "remind 08:00 · details: two.md");
    assert.equal(by.e004.meta, "remind 10:00 · remind 11:00");
    assert.equal(by.e005.doneAt, "2026-10-10");
    assert.equal(by.e005.meta, "details: ship.md");
  });

  it("keeps unknown/invalid keyed parts in meta and non-key groups in the title", () => {
    const [a, b] = parseTodo("- [ ] A (due tomorrow)\n- [ ] B (balík, list)\n").items;
    assert.equal(a.title, "A");
    assert.equal(a.due, null);
    assert.equal(a.meta, "due tomorrow");
    assert.equal(b.title, "B (balík, list)");
  });

  for (const f of [
    "todo-ids.md",
    "todo-edge.md",
    "todo-open-only.md",
    "todo-noids.md",
    "todo-no-trailing-newline.md",
    "todo-no-sections-end.md",
  ]) {
    it(`parse then serialize is byte-identical (${f})`, () => {
      const text = fixture(f);
      assert.equal(serialize(parseTodo(text).lines), text);
    });
  }

  it("round-trips CRLF files", () => {
    const text = "## Open\r\n- [ ] A\r\n";
    assert.equal(serialize(parseTodo(text).lines), text);
  });
});
