// TODO.md -> { lines, items }. Minimal version (T-001): checkbox lines, ids and `(due YYYY-MM-DD)`.
// T-002 extends this with full metadata (done/remind/meta text, links) and sections.

/**
 * @typedef {object} Item
 * @property {number} line index into `lines`
 * @property {string|null} id
 * @property {string} title
 * @property {string|null} due
 * @property {"open"|"done"} status
 */

const ITEM_RE = /^- \[([ xX])\] (.*)$/;
const ID_RE = /\s*<!--\s*id:([a-z0-9]{4,8})\s*-->\s*$/;
const DUE_RE = /\s*\(due (\d{4}-\d{2}-\d{2})\)\s*$/;

/**
 * @param {string} text
 * @returns {{lines: string[], items: Item[]}}
 */
export function parseTodo(text) {
  const lines = text.split("\n");
  /** @type {Item[]} */
  const items = [];
  lines.forEach((raw, line) => {
    const m = ITEM_RE.exec(raw.replace(/\r$/, ""));
    if (!m) return;
    let rest = m[2];
    /** @type {string|null} */
    let id = null;
    const idm = ID_RE.exec(rest);
    if (idm) {
      id = idm[1];
      rest = rest.slice(0, idm.index);
    }
    /** @type {string|null} */
    let due = null;
    const dm = DUE_RE.exec(rest);
    if (dm) {
      due = dm[1];
      rest = rest.slice(0, dm.index);
    }
    items.push({ line, id, title: rest.trim(), due, status: m[1] === " " ? "open" : "done" });
  });
  return { lines, items };
}
