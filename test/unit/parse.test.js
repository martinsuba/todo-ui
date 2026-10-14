import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTodo } from "../../src/sync/parse.js";

describe("parseTodo", () => {
  it("parses open and done checkbox lines with ids and due", () => {
    const { items, lines } = parseTodo(
      "# TODO\n\n- [ ] Pay (x) (due 2026-10-20) <!-- id:ab12 -->\n- [x] Old <!-- id:cd34 -->\n- [ ] No id\nplain\n",
    );
    assert.equal(lines.length, 7);
    assert.deepEqual(items, [
      { line: 2, id: "ab12", title: "Pay (x)", due: "2026-10-20", status: "open" },
      { line: 3, id: "cd34", title: "Old", due: null, status: "done" },
      { line: 4, id: null, title: "No id", due: null, status: "open" },
    ]);
  });

  it("handles CRLF and non-ASCII titles", () => {
    const { items } = parseTodo("- [ ] Ísť na poštu <!-- id:k3f9 -->\r\n");
    assert.equal(items[0].title, "Ísť na poštu");
    assert.equal(items[0].id, "k3f9");
  });
});
