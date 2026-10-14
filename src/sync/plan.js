// items + db rows -> neutral ops list (docs/ARCHITECTURE.md "CLI contract").
// Items with ids (never Archive): `set` when there is no db row, `update` when there is one (file fields only,
// never `tickedAt`); `delete` for db rows whose id is not in Open/Done; then `set meta/sync`.

/**
 * @param {import("./parse.js").Item[]} items
 * @param {{now: Date, warn?: (msg: string) => void, rows?: {id: string, [k: string]: any}[]}} options
 * @returns {{ops: {op: "set"|"update"|"delete", path: string, data?: Record<string, any>}[]}}
 */
export function planOps(items, { now, warn = () => {}, rows = [] }) {
  /** @type {{op: "set"|"update"|"delete", path: string, data?: Record<string, any>}[]} */
  const ops = [];
  const inDb = new Set(rows.map((r) => r.id));
  const inFile = new Set();
  const warned = new Set();
  /** @type {Map<string, number>} */
  const count = new Map();
  for (const i of items) if (i.id) count.set(i.id, (count.get(i.id) ?? 0) + 1);
  items.forEach((item) => {
    for (const w of item.warnings) warn(`${item.title}: ${w}`);
    if (item.section?.toLowerCase() === "archive") return;
    if (!item.id) {
      warn(`skipping item without id (run apply first): ${item.title}`);
      return;
    }
    inFile.add(item.id);
    if ((count.get(item.id) ?? 0) > 1) {
      if (!warned.has(item.id)) warn(`id ${item.id} appears on more than one line; no op planned`);
      warned.add(item.id);
      return;
    }
    ops.push({
      op: inDb.has(item.id) ? "update" : "set",
      path: `todos/${item.id}`,
      data: {
        title: item.title,
        due: item.due,
        meta: item.meta,
        status: item.status,
        doneAt: item.doneAt,
        order: item.order,
      },
    });
  });
  for (const id of inDb) {
    if (!inFile.has(id)) ops.push({ op: "delete", path: `todos/${id}` });
  }
  ops.push({ op: "set", path: "meta/sync", data: { syncedAt: now.toISOString() } });
  return { ops };
}
