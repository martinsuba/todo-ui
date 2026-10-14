// DOM rendering (textContent only), db subscription. T-001: open titles in `order` and the empty state.

// Due sorting, marks, done section, ticks and the db-null message come in T-003/T-004.

const appRoot = /** @type {HTMLElement} */ (document.querySelector("main"));

/** @param {any[]} rows */
function renderTodos(rows) {
  const open = rows
    .filter((r) => r.status !== "done" && !r.tickedAt)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const children = [];
  const h1 = document.createElement("h1");
  h1.textContent = "Todos";
  children.push(h1);
  if (open.length === 0) {
    const p = document.createElement("p");
    p.setAttribute("data-testid", "empty");
    p.textContent = "No todos yet — ask HAL to sync todos";
    children.push(p);
  } else {
    const ul = document.createElement("ul");
    ul.setAttribute("data-testid", "open-list");
    for (const r of open) {
      const li = document.createElement("li");
      li.setAttribute("data-testid", "todo-item");
      const title = document.createElement("span");
      title.setAttribute("data-testid", "title");
      title.textContent = String(r.title ?? "");
      li.append(title);
      ul.append(li);
    }
    children.push(ul);
  }
  appRoot.replaceChildren(...children);
}

subscribeTodos(renderTodos, () => {}).catch(() => {});
