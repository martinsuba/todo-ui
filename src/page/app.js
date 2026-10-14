// DOM rendering (textContent only), the db subscriptions, and tick-with-undo.
import {
  doneDate,
  doneWindow,
  dueState,
  formatSynced,
  isDone,
  localDate,
  sortOpen,
} from "./view.js";
import { subscribeSyncMeta, subscribeTodos, tick } from "./db.js";

/** Undo window before the single write happens. */
const UNDO_MS = 4000;

const appRoot = /** @type {HTMLElement} */ (document.querySelector("main"));
const DONE_OPEN_KEY = "todo-ui:done-open";

/** @returns {boolean} */
function readDoneOpen() {
  try {
    return localStorage.getItem(DONE_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** @param {boolean} open */
function saveDoneOpen(open) {
  try {
    localStorage.setItem(DONE_OPEN_KEY, open ? "1" : "0");
  } catch {
    // storage unavailable: the section simply starts collapsed next time
  }
}

let doneOpen = readDoneOpen();

/** @type {any[]|null} latest snapshot rows; null until the first snapshot */
let rows = null;
/** @type {string|null} */
let syncedAt = null;
/**
 * Ticks the page owns, by todo id. Until the db snapshot shows the tick, the item counts as done.
 * @type {Map<string, {title: string, iso: string, timer: ReturnType<typeof setTimeout>|null, written: boolean}>}
 */
const ticks = new Map();
/** @type {string[]} */
let errors = [];
/** @type {HTMLElement|null} */
let footerEl = null;

/**
 * @param {string} tag
 * @param {string} [testid]
 * @param {string} [text]
 */
function el(tag, testid, text) {
  const e = document.createElement(tag);
  if (testid) e.setAttribute("data-testid", testid);
  if (text !== undefined) e.textContent = text;
  return e;
}

/** @param {string} text @param {string} [role] */
function messageNode(text, role) {
  const p = el("p", "message", text);
  if (role) p.setAttribute("role", role);
  return p;
}

/** @param {HTMLElement[]} nodes */
function show(nodes) {
  const h1 = document.createElement("h1");
  h1.textContent = "Todos";
  appRoot.replaceChildren(h1, ...nodes);
}

/** @param {any} r @param {string} today */
function openItemNode(r, today) {
  const state = dueState(r, today);
  const li = el("li", "todo-item");
  li.setAttribute("data-due-state", state);

  const tickBtn = el("button", "tick");
  tickBtn.setAttribute("type", "button");
  tickBtn.setAttribute("aria-label", `Mark done: ${String(r.title ?? "")}`);
  tickBtn.addEventListener("click", () => startTick(r.id, String(r.title ?? "")));

  const body = el("div");
  body.className = "body";
  body.append(el("span", "title", String(r.title ?? "")));
  if (r.due) {
    const due = el("span", "due", String(r.due));
    body.append(" ", due);
  }
  if (state !== "none") {
    const label = state === "overdue" ? "overdue" : "due today";
    const badge = el("span", "badge", state === "overdue" ? "Overdue" : "Due today");
    badge.className = `badge ${state}`;
    badge.setAttribute("role", "img");
    badge.setAttribute("aria-label", label);
    body.append(" ", badge);
  }
  if (r.meta) body.append(el("div", "meta", String(r.meta)));
  li.append(tickBtn, body);
  return li;
}

/** @param {any[]} done */
function doneSectionNode(done) {
  const details = /** @type {HTMLDetailsElement} */ (el("details", "done-section"));
  details.open = doneOpen;
  details.addEventListener("toggle", () => {
    doneOpen = details.open;
    saveDoneOpen(doneOpen);
  });
  details.append(el("summary", undefined, `Done (${done.length})`));
  const ul = el("ul");
  for (const r of done) {
    const li = el("li", "done-item");
    li.append(el("span", "title", String(r.title ?? "")));
    const date = doneDate(r);
    if (date) li.append(" ", el("span", "done-date", date));
    ul.append(li);
  }
  details.append(ul);
  return details;
}

function updateFooter() {
  if (!footerEl) return;
  const text = formatSynced(syncedAt, Date.now());
  footerEl.hidden = text === null;
  footerEl.textContent = text ?? "";
}

function undoBarNode() {
  const bar = el("div", "undo-bar");
  bar.setAttribute("role", "status");
  bar.setAttribute("aria-live", "polite");
  for (const [id, t] of ticks) {
    if (t.timer === null) continue;
    const row = el("div", "undo-row");
    row.append(el("span", undefined, `Marked done: ${t.title}`));
    const btn = el("button", "undo", "Undo");
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", `Undo: ${t.title}`);
    btn.setAttribute("data-undo-id", id);
    btn.addEventListener("click", () => undo(id));
    row.append(btn);
    bar.append(row);
  }
  return bar;
}

/** Rows as displayed: pending / in-flight / just-written ticks count as done. */
function displayRows() {
  return (rows ?? []).map((r) => {
    const t = ticks.get(r.id);
    return t && !isDone(r) ? { ...r, tickedAt: t.iso } : r;
  });
}

/** Focus to restore after the next render: an Undo button by tick id, or the list. */
let focusUndoId = /** @type {string|null} */ (null);

function render() {
  if (rows === null) return;
  const active = document.activeElement;
  const lostUndo = Boolean(active && active.closest('[data-testid="undo-bar"]'));
  renderTodos(displayRows());
  if (focusUndoId !== null) {
    const btn = document.querySelector(`[data-undo-id="${CSS.escape(focusUndoId)}"]`);
    focusUndoId = null;
    if (btn instanceof HTMLElement) {
      btn.focus();
      return;
    }
  }
  if (lostUndo) focusList();
}

function focusList() {
  const target = document.querySelector('[data-testid="open-list"]') ?? appRoot;
  target.setAttribute("tabindex", "-1");
  /** @type {HTMLElement} */ (target).focus();
}

/** @param {string} id */
function undo(id) {
  const t = ticks.get(id);
  if (!t || t.timer === null) return;
  clearTimeout(t.timer);
  ticks.delete(id);
  render();
}

/** @param {string} id */
async function flush(id) {
  const t = ticks.get(id);
  if (!t) return;
  t.timer = null; // in flight: no Undo any more, never written twice
  render();
  try {
    await tick(id, new Date().toISOString());
    t.written = true;
    if (ticks.get(id) === t && !(rows ?? []).some((r) => r.id === id && !isDone(r)))
      ticks.delete(id);
  } catch {
    ticks.delete(id);
    errors = [`Could not mark "${t.title}" as done. It is back in your list; try again.`];
  }
  render();
}

/** @param {string} id @param {string} title */
function startTick(id, title) {
  if (ticks.has(id)) return;
  errors = [];
  const entry = {
    title,
    iso: new Date().toISOString(),
    written: false,
    timer: /** @type {ReturnType<typeof setTimeout>|null} */ (null),
  };
  entry.timer = setTimeout(() => void flush(id), UNDO_MS);
  ticks.set(id, entry);
  focusUndoId = id;
  render();
}

/** Drop tick entries a snapshot has made obsolete. @param {any[]} snapRows */
function reconcile(snapRows) {
  for (const [id, t] of ticks) {
    const r = snapRows.find((x) => x.id === id);
    const gone = !r || isDone(r);
    if (gone && t.timer !== null) clearTimeout(t.timer);
    // pending: only drop when the row is gone/done elsewhere; written: drop once the snapshot shows it
    if (gone || (t.written && r && isDone(r))) ticks.delete(id);
  }
}

/** @param {any[]} snapRows */
function onTodos(snapRows) {
  reconcile(snapRows);
  rows = snapRows;
  render();
}

/** @param {any[]} rows */
function renderTodos(rows) {
  const today = localDate(new Date());
  const open = sortOpen(rows);
  const done = doneWindow(rows, today);
  /** @type {HTMLElement[]} */
  const nodes = [];
  if (rows.length === 0) {
    nodes.push(messageNode("No todos yet — ask HAL to sync todos"));
  } else if (open.length === 0) {
    nodes.push(messageNode("Nothing open. All done!"));
  } else {
    const ul = el("ul", "open-list");
    for (const r of open) ul.append(openItemNode(r, today));
    nodes.push(ul);
  }
  if (done.length > 0) nodes.push(doneSectionNode(done));
  if (ticks.size > 0 && [...ticks.values()].some((t) => t.timer !== null))
    nodes.push(undoBarNode());
  for (const msg of errors) nodes.push(messageNode(msg, "alert"));
  footerEl = el("p", "sync-footer");
  nodes.push(footerEl);
  show(nodes);
  updateFooter();
}

function renderUnavailable() {
  show([
    messageNode("The todo list needs claude.ai: open this page on claude.ai while signed in."),
  ]);
}

function renderError() {
  show([
    messageNode(
      "Could not load your todos. Reload the page, or check that you are signed in to claude.ai.",
      "alert",
    ),
  ]);
}

subscribeTodos(onTodos, renderError).then((ok) => {
  if (!ok) renderUnavailable();
}, renderError);

subscribeSyncMeta((at) => {
  syncedAt = at;
  updateFooter();
}).catch(() => {
  // the footer is optional: stay hidden
});
// keep "Synced X ago" fresh
setInterval(updateFooter, 30000);
