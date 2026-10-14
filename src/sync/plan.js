// items + db rows -> neutral ops list (docs/ARCHITECTURE.md "CLI contract").
// Items with ids (never Archive): `set` when there is no db row, `update` when there is one (file fields only,
// never `tickedAt`); `delete` for db rows whose id is not in Open/Done; then `set meta/sync`.

// A row's numeric `version` becomes `ifVersion` on its update/delete op; `metaVersion` on the meta/sync op.

/**
 * @typedef {{op: "set"|"update"|"delete", path: string, data?: Record<string, any>, ifVersion?: number}} Op
 */

/** @param {unknown} v */
const isVersion = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * @param {import("./parse.js").Item[]} items
 * @param {{now: Date, warn?: (msg: string) => void, rows?: {id: string, [k: string]: any}[], metaVersion?: number}} options
 * @returns {{ops: Op[]}}
 */
export function planOps(items, { now, warn = () => {}, rows = [], metaVersion }) {
  /** @type {Op[]} */
  const ops = [];
  const inDb = new Set(rows.map((r) => r.id));
  /** @type {(id: string) => {ifVersion?: number}} */
  const ver = (id) => {
    const v = rows.find((r) => r.id === id)?.version;
    return isVersion(v) ? { ifVersion: v } : {};
  };
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
    const exists = inDb.has(item.id);
    ops.push({
      op: exists ? "update" : "set",
      path: `todos/${item.id}`,
      ...(exists ? ver(item.id) : {}),
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
    if (!inFile.has(id)) ops.push({ op: "delete", path: `todos/${id}`, ...ver(id) });
  }
  ops.push({
    op: "set",
    path: "meta/sync",
    data: { syncedAt: now.toISOString() },
    ...(isVersion(metaVersion) ? { ifVersion: metaVersion } : {}),
  });
  return { ops };
}

export const MAX_BATCH = 50;

/**
 * Neutral ops -> ArtifactData `batch` writes, chunked; a document is addressed at most once per batch.
 * @param {Op[]} ops
 * @param {number} [max]
 * @returns {{batches: {op: string, collection: string, doc_id: string, data?: Record<string, any>, if_version?: number}[][]}}
 */
export function toArtifactData(ops, max = MAX_BATCH) {
  /** @type {{op: string, collection: string, doc_id: string, data?: Record<string, any>, if_version?: number}[][]} */
  const batches = [];
  let cur = /** @type {typeof batches[number]} */ ([]);
  let seen = new Set();
  for (const o of ops) {
    const [collection, doc_id] = o.path.split("/");
    const key = o.path;
    if (cur.length >= max || seen.has(key)) {
      batches.push(cur);
      cur = [];
      seen = new Set();
    }
    seen.add(key);
    cur.push({
      op: o.op,
      collection,
      doc_id,
      ...(o.data !== undefined ? { data: o.data } : {}),
      ...(o.ifVersion !== undefined ? { if_version: o.ifVersion } : {}),
    });
  }
  if (cur.length) batches.push(cur);
  return { batches };
}
