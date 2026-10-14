// Pure view logic (sorting, overdue / due-today, done window). No DOM, no clock: "today" is injected.

/** Days a done item stays visible. */
export const DONE_WINDOW_DAYS = 7;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {unknown} s @returns {s is string} */
function isDateString(s) {
  return typeof s === "string" && DATE_RE.test(s);
}

/**
 * Local calendar date (YYYY-MM-DD) of a Date, in the viewer's time zone. Never uses toISOString.
 * @param {Date} d
 */
export function localDate(d) {
  const p = (/** @type {number} */ n, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Shift a YYYY-MM-DD date by whole days (calendar arithmetic, no time zone involved).
 * @param {string} ymd
 * @param {number} days
 */
export function addDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** @param {any} item */
export function isDone(item) {
  return item.status === "done" || Boolean(item.tickedAt);
}

/** Valid due date or null. @param {any} item */
function dueOf(item) {
  return isDateString(item.due) ? item.due : null;
}

/** @param {any} item */
function orderOf(item) {
  return typeof item.order === "number" ? item.order : 0;
}

/**
 * Open items sorted by due date ascending, undated last, ties by file `order`.
 * @param {any[]} rows
 */
export function sortOpen(rows) {
  return rows
    .filter((r) => !isDone(r))
    .sort((a, b) => {
      const da = dueOf(a);
      const db = dueOf(b);
      if (da !== db) {
        if (da === null) return 1;
        if (db === null) return -1;
        return da < db ? -1 : 1;
      }
      return orderOf(a) - orderOf(b);
    });
}

/**
 * @param {{due?: unknown}} item
 * @param {string} today local YYYY-MM-DD
 * @returns {"overdue"|"today"|"none"}
 */
export function dueState(item, today) {
  const due = dueOf(item);
  if (due === null) return "none";
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "none";
}

/**
 * Done date: `doneAt`, else the local date of `tickedAt`, else null.
 * @param {any} item
 * @returns {string|null}
 */
export function doneDate(item) {
  if (isDateString(item.doneAt)) return item.doneAt;
  if (item.tickedAt) {
    const t = new Date(item.tickedAt);
    if (!Number.isNaN(t.getTime())) return localDate(t);
  }
  return null;
}

/**
 * Done items finished within the last 7 days (newest first). Items with no known done date are kept.
 * @param {any[]} rows
 * @param {string} today local YYYY-MM-DD
 */
export function doneWindow(rows, today) {
  const oldest = addDays(today, -DONE_WINDOW_DAYS);
  return rows
    .filter(isDone)
    .map((r) => ({ row: r, date: doneDate(r) }))
    .filter((x) => x.date === null || x.date >= oldest)
    .sort((a, b) => {
      if (a.date !== b.date) {
        if (a.date === null) return 1;
        if (b.date === null) return -1;
        return a.date < b.date ? 1 : -1;
      }
      return orderOf(a.row) - orderOf(b.row);
    })
    .map((x) => x.row);
}

/**
 * "Synced 5 min ago" / "2 h ago" / "3 d ago" for an ISO timestamp, or null if it is not a valid date.
 * @param {unknown} syncedAt
 * @param {number} nowMs epoch milliseconds
 * @returns {string|null}
 */
export function formatSynced(syncedAt, nowMs) {
  if (typeof syncedAt !== "string") return null;
  const t = Date.parse(syncedAt);
  if (Number.isNaN(t)) return null;
  const minutes = Math.floor(Math.max(0, nowMs - t) / 60000);
  if (minutes < 1) return "Synced just now";
  if (minutes < 60) return `Synced ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours} h ago`;
  return `Synced ${Math.floor(hours / 24)} d ago`;
}
