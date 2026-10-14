// Row normalisation and validation shared by `apply` and `plan` (docs/ARCHITECTURE.md "CLI contract").
// db rows are untrusted data: only their shape is checked, they are never executed or followed.

export const ID_FORMAT = /^[a-z0-9]{4,8}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * @typedef {{id: string, tickedAt?: string, [k: string]: any}} Row
 * @typedef {{id: string|null, reason: string}} Skipped
 */

/** @param {unknown} s */
export function isIsoDate(s) {
  return typeof s === "string" && ISO_RE.test(s) && !Number.isNaN(Date.parse(s));
}

/**
 * Accepts `[{id,...}]` or `{docs:[{id,data}]}`; returns the flat entries (not yet validated).
 * @param {unknown} raw parsed rows.json
 * @returns {unknown[]}
 */
export function normalizeRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && Array.isArray(/** @type {any} */ (raw).docs)) {
    return /** @type {any} */ (raw).docs.map((/** @type {any} */ d) =>
      d && typeof d === "object" && !Array.isArray(d)
        ? {
            ...(d.data && typeof d.data === "object" && !Array.isArray(d.data) ? d.data : {}),
            id: d.id,
          }
        : d,
    );
  }
  throw new Error("rows must be an array of {id,...} or an object {docs:[{id,data}]}");
}

/**
 * @param {unknown} raw parsed rows.json
 * @returns {{rows: Row[], skipped: Skipped[]}}
 */
export function validateRows(raw) {
  /** @type {Row[]} */
  const rows = [];
  /** @type {Skipped[]} */
  const skipped = [];
  for (const entry of normalizeRows(raw)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      skipped.push({ id: null, reason: "invalid row: not an object" });
      continue;
    }
    const e = /** @type {Record<string, any>} */ (entry);
    if (typeof e.id !== "string" || !ID_FORMAT.test(e.id)) {
      skipped.push({ id: typeof e.id === "string" ? e.id : null, reason: "invalid row: bad id" });
      continue;
    }
    if (e.tickedAt !== undefined && e.tickedAt !== null && !isIsoDate(e.tickedAt)) {
      skipped.push({ id: e.id, reason: "invalid row: bad tickedAt" });
      continue;
    }
    rows.push(/** @type {Row} */ (e));
  }
  return { rows, skipped };
}
