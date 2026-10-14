// TODO.md -> { lines, items } (docs/PRD.md "TODO.md format"). `lines` is the original text split on "\n"
// (CR kept), so joining it with "\n" gives back the exact input bytes (see write.js).

/**
 * @typedef {object} Item
 * @property {number} line index into `lines`
 * @property {string|null} id
 * @property {string} title
 * @property {string|null} due YYYY-MM-DD
 * @property {string|null} doneAt YYYY-MM-DD
 * @property {string|null} meta display text, e.g. "remind 13:00 · details: x.md"
 * @property {"open"|"done"} status
 * @property {string|null} section name of the enclosing `## ` section, or null
 * @property {number} order index among all items in file order
 */

const ITEM_RE = /^- \[([ xX])\] (.*)$/;
const SECTION_RE = /^##\s+(.*?)\s*$/;
const ID_RE = /\s*<!--\s*id:([a-z0-9]{4,8})\s*-->\s*$/;
const LINK_RE = /\s*→\s*\[[^\]]*\]\(([^()\s]*)\)\s*$/;
const GROUP_RE = /\s*\(([^()]*)\)\s*$/;
const KEY_RE = /^(due|done|remind)(\s|$)/;
const DATE_RE = /^(due|done) (\d{4}-\d{2}-\d{2})$/;

/**
 * Splits one line's text (after the checkbox) into its parts.
 * @param {string} text
 */
function parseItemText(text) {
  let rest = text;
  /** @type {string|null} */
  let id = null;
  const idm = ID_RE.exec(rest);
  if (idm) {
    id = idm[1];
    rest = rest.slice(0, idm.index);
  }
  /** @type {string|null} */
  let link = null;
  const lm = LINK_RE.exec(rest);
  if (lm) {
    link = lm[1];
    rest = rest.slice(0, lm.index);
  }
  /** @type {string|null} */
  let due = null;
  /** @type {string|null} */
  let doneAt = null;
  /** @type {string[]} */
  const metaGroups = [];
  for (;;) {
    const gm = GROUP_RE.exec(rest);
    if (!gm) break;
    const parts = gm[1].split(",").map((p) => p.trim());
    if (!parts.every((p) => KEY_RE.test(p))) break;
    /** @type {string[]} */
    const extra = [];
    for (const p of parts) {
      const dm = DATE_RE.exec(p);
      if (dm && dm[1] === "due" && due === null) due = dm[2];
      else if (dm && dm[1] === "done" && doneAt === null) doneAt = dm[2];
      else extra.push(p);
    }
    metaGroups.unshift(extra.join(" · "));
    rest = rest.slice(0, gm.index);
  }
  const metaParts = metaGroups.filter(Boolean);
  if (link !== null) metaParts.push(`details: ${link}`);
  return {
    id,
    title: rest.trim(),
    due,
    doneAt,
    meta: metaParts.length ? metaParts.join(" · ") : null,
  };
}

/**
 * @param {string} text
 * @returns {{lines: string[], items: Item[]}}
 */
export function parseTodo(text) {
  const lines = text.split("\n");
  /** @type {Item[]} */
  const items = [];
  /** @type {string|null} */
  let section = null;
  lines.forEach((raw, line) => {
    const clean = raw.replace(/\r$/, "");
    const sm = SECTION_RE.exec(clean);
    if (sm) {
      section = sm[1];
      return;
    }
    const m = ITEM_RE.exec(clean);
    if (!m) return;
    items.push({
      line,
      ...parseItemText(m[2]),
      status: m[1] === " " ? "open" : "done",
      section,
      order: items.length,
    });
  });
  return { lines, items };
}
