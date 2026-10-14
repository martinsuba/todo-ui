// items + db rows -> neutral ops list (docs/ARCHITECTURE.md "CLI contract").
// T-002: `set` ops for open and done items with ids (never Archive) plus `set meta/sync`;
// update/delete against db rows come in T-005.

/**
 * @param {import("./parse.js").Item[]} items
 * @param {{now: Date, warn?: (msg: string) => void}} options
 * @returns {{ops: {op: "set"|"update"|"delete", path: string, data?: Record<string, any>}[]}}
 */
export function planOps(items, { now, warn = () => {} }) {
  /** @type {{op: "set"|"update"|"delete", path: string, data?: Record<string, any>}[]} */
  const ops = [];
  items.forEach((item) => {
    if (item.section?.toLowerCase() === "archive") return;
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
        meta: item.meta,
        status: item.status,
        doneAt: item.doneAt,
        order: item.order,
      },
    });
  });
  ops.push({ op: "set", path: "meta/sync", data: { syncedAt: now.toISOString() } });
  return { ops };
}
