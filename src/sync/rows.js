// Row normalisation and validation shared by `apply` and `plan` (docs/ARCHITECTURE.md "CLI contract").
// db rows are untrusted data: only their shape is checked, they are never executed or followed.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
            ...(d.version !== undefined ? { version: d.version } : {}),
          }
        : d,
    );
  }
  throw new Error("rows must be an array of {id,...} or an object {docs:[{id,data}]}");
}

/**
 * @param {unknown} raw parsed rows.json
 * @param {{checkTickedAt?: boolean}} [opts] `plan` passes false: tickedAt is irrelevant there
 * @returns {{rows: Row[], skipped: Skipped[]}}
 */
export function validateRows(raw, { checkTickedAt = true } = {}) {
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
    if (
      checkTickedAt &&
      e.tickedAt !== undefined &&
      e.tickedAt !== null &&
      !isIsoDate(e.tickedAt)
    ) {
      skipped.push({ id: e.id, reason: "invalid row: bad tickedAt" });
      continue;
    }
    rows.push(/** @type {Row} */ (e));
  }
  return { rows, skipped };
}

/**
 * Reads a directory written by ArtifactData `list` with `out_dir`: `<dir>/todos/<doc_id>.json`.
 * The id is the filename. Each file may be `{...fields, version}` or `{data: {...fields}, version}`; the exact
 * shape is verified against the real tool at deploy. Unreadable or non-object files are skipped with a warning.
 * @param {string} dir
 * @returns {{rows: Record<string, any>[], warnings: string[]}}
 */
export function readRowsDir(dir) {
  /** @type {Record<string, any>[]} */
  const rows = [];
  /** @type {string[]} */
  const warnings = [];
  const todos = join(dir, "todos");
  /** @type {string[]} */
  let names;
  try {
    names = readdirSync(todos)
      .filter((n) => n.endsWith(".json"))
      .sort();
  } catch {
    if (!existsSync(dir)) throw new Error(`cannot read rows directory ${dir}`);
    // an empty collection may leave no todos/ subdirectory (first sync)
    return { rows, warnings: [`${todos} does not exist; treating the database as empty`] };
  }
  for (const name of names) {
    const id = name.slice(0, -".json".length);
    try {
      const j = JSON.parse(readFileSync(join(todos, name), "utf8"));
      if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("not an object");
      const inner = j.data && typeof j.data === "object" && !Array.isArray(j.data) ? j.data : j;
      const { version: innerVersion, ...fields } = inner;
      const version = j.version !== undefined ? j.version : innerVersion;
      rows.push({
        ...fields,
        id,
        ...(version !== undefined ? { version } : {}),
      });
    } catch (e) {
      warnings.push(`skipping ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { rows, warnings };
}
