// items + db rows -> neutral ops list (docs/ARCHITECTURE.md "CLI contract").
// T-001: only `set` ops for open items with ids plus `set meta/sync`; update/delete come in T-005.

/**
 * @param {import("./parse.js").Item[]} items
 * @param {{now: Date, warn?: (msg: string) => void}} options
 * @returns {{ops: {op: "set"|"update"|"delete", path: string, data?: Record<string, any>}[]}}
 */
export function planOps(items, { now, warn = () => {} }) {
  /** @type {{op: "set"|"update"|"delete", path: string, data?: Record<string, any>}[]} */
  const ops = [];
  items.forEach((item, order) => {
    if (item.status !== "open") return;
    if (!item.id) {
      warn(`skipping item without id (run apply first): ${item.title}`);
      return;
    }
    ops.push({
      op: "set",
      path: `todos/${item.id}`,
      data: {
        title: item.title,
        due: item.due,
        meta: null,
        status: "open",
        doneAt: null,
        order,
      },
    });
  });
  ops.push({ op: "set", path: "meta/sync", data: { syncedAt: now.toISOString() } });
  return { ops };
}
