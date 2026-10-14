// db rows -> file edits: ticks, archive, ids (docs/ARCHITECTURE.md "CLI contract", docs/PRD.md REQ-009).
import { parseTodo } from "./parse.js";
import { validateRows } from "./rows.js";
import { blockLength, insertIntoSection, readUtf8, serialize, writeFileAtomic } from "./write.js";

const ID_RE = /\s*<!--\s*id:([a-z0-9]{4,8})\s*-->\s*$/;
const LINK_RE = /\s*→\s*\[[^\]]*\]\([^()\s]*\)\s*$/;
const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * @typedef {object} Summary
 * @property {{id: string, title: string}[]} markedDone
 * @property {{id: string, title: string}[]} archived
 * @property {{id: string|null, reason: string}[]} skipped
 * @property {number} idsAdded
 */

const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");

/** Local (process TZ) calendar date of an instant, YYYY-MM-DD. @param {Date} d */
export function localDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** @param {string} ymd @param {number} days */
function shiftDate(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Ticked form of an open item line (no CR): `[x]`, ` (done D)` after the metadata, before link and id.
 * @param {string} clean
 * @param {string} date
 */
function tickLine(clean, date) {
  let rest = clean.replace(/^- \[ \]/, "- [x]");
  const idm = ID_RE.exec(rest);
  const idPart = idm ? idm[0] : "";
  if (idm) rest = rest.slice(0, idm.index);
  const lm = LINK_RE.exec(rest);
  const linkPart = lm ? lm[0] : "";
  if (lm) rest = rest.slice(0, lm.index);
  return `${rest} (done ${date})${linkPart}${idPart}`;
}

/**
 * Pure core: text + raw rows -> new text + summary.
 * @param {string} text
 * @param {unknown} rawRows parsed rows.json
 * @param {{now: Date, rng?: () => number}} opts
 * @returns {{text: string, summary: Summary}}
 */
export function applyTodo(text, rawRows, { now, rng = Math.random }) {
  const crlf = text.indexOf("\n") > 0 && text[text.indexOf("\n") - 1] === "\r";
  const cr = crlf ? "\r" : "";
  const hadNewline = text.endsWith("\n");
  const { lines: parsedLines, items } = parseTodo(
    hadNewline ? text : text + (crlf ? "\r\n" : "\n"),
  );
  let lines = parsedLines;
  const { rows, skipped } = validateRows(rawRows);
  /** @type {Summary} */
  const summary = { markedDone: [], archived: [], skipped: [...skipped], idsAdded: 0 };

  const used = new Set(items.flatMap((i) => (i.id ? [i.id] : [])));
  const isArchive = (/** @type {import("./parse.js").Item} */ i) =>
    i.section?.toLowerCase() === "archive";

  // ticks
  /** @type {Map<number, string>} item.line -> replacement text (no CR) */
  const edits = new Map();
  /** @type {number[]} */
  const toDoneTop = [];
  for (const row of rows) {
    if (row.tickedAt === undefined || row.tickedAt === null) continue;
    const matches = items.filter((i) => i.id === row.id);
    if (matches.length > 1) {
      summary.skipped.push({ id: row.id, reason: "ambiguous id" });
      continue;
    }
    const item = matches[0];
    if (!item) {
      summary.skipped.push({ id: row.id, reason: "not in file" });
      continue;
    }
    if (item.status === "done" || edits.has(item.line)) {
      summary.skipped.push({ id: row.id, reason: "already done" });
      continue;
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(row.tickedAt)
      ? row.tickedAt
      : localDate(new Date(row.tickedAt));
    edits.set(item.line, tickLine(lines[item.line].replace(/\r$/, ""), date));
    toDoneTop.push(item.line);
    summary.markedDone.push({ id: row.id, title: item.title });
  }

  // archive candidates (original done items only; just-ticked ones are today's)
  const cutoff = shiftDate(localDate(now), -7);
  const toArchive = items.filter(
    (i) => i.status === "done" && !isArchive(i) && i.doneAt !== null && i.doneAt < cutoff,
  );

  // ids
  /** @type {Map<number, string>} */
  const newIds = new Map();
  for (const item of items) {
    if (item.id) continue;
    let id;
    do {
      id = Array.from({ length: 4 }, () => BASE36[Math.floor(rng() * 36) % 36]).join("");
    } while (used.has(id));
    used.add(id);
    newIds.set(item.line, id);
    edits.set(
      item.line,
      `${edits.get(item.line) ?? lines[item.line].replace(/\r$/, "")} <!-- id:${id} -->`,
    );
    summary.idsAdded++;
  }
  for (const i of toArchive) {
    summary.archived.push({
      id: i.id ?? /** @type {string} */ (newIds.get(i.line)),
      title: i.title,
    });
  }

  // apply in-place edits (indexes stay stable), then moves
  lines = lines.slice();
  for (const [at, t] of edits) lines[at] = t + (/\r$/.test(lines[at]) ? "\r" : "");
  /** @param {number[]} starts item line indexes */
  const blocks = (starts) => starts.flatMap((at) => lines.slice(at, at + blockLength(lines, at)));
  const doneBlock = blocks(toDoneTop.sort((a, b) => a - b));
  const archiveBlock = blocks(toArchive.map((i) => i.line));
  const moved = new Set();
  for (const at of [...toDoneTop, ...toArchive.map((i) => i.line)]) {
    for (let k = 0; k < blockLength(lines, at); k++) moved.add(at + k);
  }
  if (moved.size > 0) {
    lines = lines.filter((_, i) => !moved.has(i));
    lines = insertIntoSection(lines, "Done", doneBlock, {
      where: "top",
      beforeSection: "Archive",
      cr,
    });
    lines = insertIntoSection(lines, "Archive", archiveBlock, { where: "end", cr });
  }

  let out = serialize(lines);
  if (!hadNewline) out = out.replace(/\r?\n$/, "");
  return { text: out, summary };
}

/**
 * File wrapper: reads, applies, writes atomically (unless dry-run or unchanged).
 * @param {string} file
 * @param {unknown} rawRows
 * @param {{now: Date, rng?: () => number, dryRun?: boolean, beforeCommit?: () => void}} opts
 * @returns {Summary}
 */
export function applyFile(file, rawRows, { now, rng, dryRun = false, beforeCommit }) {
  const { bytes: original, text: before } = readUtf8(file);
  const { text, summary } = applyTodo(before, rawRows, { now, rng });
  if (!dryRun && text !== before) writeFileAtomic(file, original, text, { beforeCommit });
  return summary;
}
