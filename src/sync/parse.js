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
 * @property {string[]} warnings problems found while parsing (e.g. a due date left in the title)
 */

const ITEM_RE = /^- \[([ xX])\] (.*)$/;
const FENCE_RE = /^ {0,3}(```|~~~)/;
const SECTION_RE = /^##\s+(.*?)\s*$/;
const ID_RE = /\s*<!--\s*id:([a-z0-9]{4,8})\s*-->\s*$/;
const LINK_RE = /\s*→\s*\[[^\]]*\]\(([^()\s]*)\)\s*$/;
const GROUP_RE = /\s*\(([^()]*)\)\s*$/;
const KEY_RE = /^(due|done|remind)(\s|$)/;
const DATE_RE = /^(due|done) (\d{4}-\d{2}-\d{2})$/;

/** @param {string} d YYYY-MM-DD that is a real calendar date */
function isRealDate(d) {
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

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
  /** @type {string[]} */
  const warnings = [];
  for (;;) {
    const gm = GROUP_RE.exec(rest);
    if (!gm) break;
    const parts = gm[1].split(",").map((p) => p.trim());
    if (!parts.every((p) => KEY_RE.test(p))) {
      if (parts.some((p) => /^(due|done)\s/.test(p))) {
        warnings.push(`"(${gm[1]})" contains due/done but stays in the title`);
      }
      break;
    }
    /** @type {string[]} */
    const extra = [];
    for (const p of parts) {
      const dm = DATE_RE.exec(p);
      if (dm && !isRealDate(dm[2])) extra.push(p);
      else if (dm && dm[1] === "due" && due === null) due = dm[2];
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
    warnings,
  };
}

/**
 * @param {string} text
 * @returns {{lines: string[], items: Item[], warnings: string[]}}
 */
export function parseTodo(text) {
  const lines = text.split("\n");
  /** @type {Item[]} */
  const items = [];
  /** @type {string|null} */
  let section = null;
  /** @type {string|null} open fence marker char ("`" or "~") */
  let fence = null;
  lines.forEach((raw, line) => {
    const clean = raw.replace(/\r$/, "").replace(/^\uFEFF/, "");
    const fm = FENCE_RE.exec(clean);
    if (fm) {
      if (fence === null) fence = fm[1][0];
      else if (fm[1][0] === fence) fence = null;
      return;
    }
    if (fence !== null) return;
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
  /** @type {string[]} */
  const warnings = [];
  if (fence !== null) warnings.push("unclosed code fence at end of file; later items are ignored");
  return { lines, items, warnings };
}
