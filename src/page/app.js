// DOM rendering (textContent only) and the db subscription. Ticks and the sync footer come in T-004.
import { doneDate, doneWindow, dueState, localDate, sortOpen } from "./view.js";
import { subscribeTodos } from "./db.js";

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

  const tick = el("button", "tick");
  tick.setAttribute("type", "button");
  tick.setAttribute("aria-label", `Mark done: ${String(r.title ?? "")}`);

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
  li.append(tick, body);
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
  show(nodes);
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

subscribeTodos(renderTodos, renderError).then((ok) => {
  if (!ok) renderUnavailable();
}, renderError);
