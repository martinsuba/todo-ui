// `todo-sync preview`: human-readable list of what a sync would push (never writes).

/**
 * @param {import("./parse.js").Item[]} items
 * @param {string[]} [warnings] parser warnings
 * @returns {string}
 */
export function renderPreview(items, warnings = []) {
  const live = items.filter((i) => i.section?.toLowerCase() !== "archive");
  const open = live.filter((i) => i.status === "open");
  const done = live.filter((i) => i.status === "done");
  /** @type {string[]} */
  const out = [];
  /** @param {string} head @param {import("./parse.js").Item[]} list */
  const section = (head, list) => {
    out.push(`${head} (${list.length})`);
    for (const i of list) {
      out.push(`- ${i.title}`);
      const bits = [];
      if (i.due) bits.push(`due ${i.due}`);
      if (i.doneAt) bits.push(`done ${i.doneAt}`);
      if (i.meta) bits.push(i.meta);
      if (bits.length) out.push(`    ${bits.join(" · ")}`);
      if (!i.id) out.push("    (no id yet — apply adds one)");
    }
    out.push("");
  };
  section("Open", open);
  section("Done", done);
  const counts = new Map();
  for (const i of live) if (i.id) counts.set(i.id, (counts.get(i.id) ?? 0) + 1);
  for (const [id, n] of counts) {
    if (n > 1) out.push(`warning: id ${id} is on ${n} lines (ambiguous; no op would be planned)`);
  }
  for (const i of live) for (const w of i.warnings) out.push(`warning: ${i.title}: ${w}`);
  for (const w of warnings) out.push(`warning: ${w}`);
  out.push(`${open.length} open, ${done.length} done would be pushed.`);
  return out.join("\n") + "\n";
}
