// Serves dist/todo.html with test/fake-claude.js and demo data injected, for local viewing.
// Usage: npm run dev [-- --port 5173]   (rebuilds on every request)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const portArg = process.argv.indexOf("--port");
const port = portArg > 0 ? Number(process.argv[portArg + 1]) : 5173;

const today = new Date();
const day = (offset) => {
  const d = new Date(today.getTime() + offset * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const row = (title, extra, order) => ({
  title,
  due: null,
  meta: null,
  status: "open",
  doneAt: null,
  order,
  ...extra,
});
const seed = {
  "todos/k3f9": row("Ísť na poštu (balík, list)", { due: day(0), meta: "remind 13:00" }, 0),
  "todos/a81c": row("Try new laptop setup", { due: day(4), meta: "details: laptop.md" }, 1),
  "todos/x02m": row("Plan weekend trip", {}, 2),
  "todos/o001": row("Pay the electricity bill", { due: day(-2) }, 3),
  "todos/p7q1": row("Renew library card", { status: "done", doneAt: day(-1) }, 4),
  "meta/sync": { syncedAt: new Date(today.getTime() - 2 * 3600000).toISOString() },
};

createServer((req, res) => {
  try {
    if (req.url === "/fake-claude.js") {
      res.setHeader("content-type", "text/javascript");
      return res.end(readFileSync(join(root, "test", "fake-claude.js")));
    }
    execFileSync("node", [join(root, "scripts", "build.mjs")], { stdio: "ignore" });
    const html = readFileSync(join(root, "dist", "todo.html"), "utf8").replace(
      "<head>",
      `<head><script>window.__FAKE_CLAUDE_CONFIG = ${JSON.stringify({ seed })};</script><script src="/fake-claude.js"></script>`,
    );
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e));
  }
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/ (fake db, demo data)`));
