import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTodo } from "../../src/sync/parse.js";
import { renderPreview } from "../../src/sync/preview.js";

describe("renderPreview", () => {
  const text = [
    "## Open",
    "- [ ] Pay rent (due 2026-10-20, remind 13:00) <!-- id:aaa1 -->",
    "- [ ] No id yet",
    "## Done",
    "- [x] Fix (done 2026-10-14) → [details](f.md) <!-- id:bbb2 -->",
    "## Archive",
    "- [x] Ancient (done 2026-01-01) <!-- id:ccc3 -->",
    "",
  ].join("\n");
  const out = () => {
    const { items, warnings } = parseTodo(text);
    return renderPreview(items, warnings);
  };

  it("lists open then done with due, done date and meta; omits archive", () => {
    const o = out();
    assert.ok(o.indexOf("Pay rent") < o.indexOf("Fix"));
    assert.match(o, /due 2026-10-20 · remind 13:00/);
    assert.match(o, /done 2026-10-14 · details: f\.md/);
    assert.ok(!o.includes("Ancient"));
    assert.match(o, /2 open|1 open, 1 done/);
  });
  it("marks items without id", () => {
    const o = out();
    assert.match(o, /No id yet\n.*\(no id yet — apply adds one\)/);
    assert.equal(o.match(/no id yet — apply/g)?.length, 1);
  });
  it("prints parser warnings and ambiguous ids", () => {
    const { items } = parseTodo(
      "- [ ] A <!-- id:dup1 -->\n- [ ] B <!-- id:dup1 -->\n- [ ] C (due 2026-11-01, call back)\n",
    );
    const o = renderPreview(items, ["unclosed code fence"]);
    assert.match(o, /warning: id dup1 is on 2 lines/);
    assert.match(o, /warning: C \(due 2026-11-01, call back\)/);
    assert.match(o, /warning: unclosed code fence/);
  });
});
