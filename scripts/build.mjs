// Inlines src/page/styles.css and the page JS modules into src/page/index.html -> dist/todo.html.
// Modules are concatenated into one classic script: `import` lines are dropped and `export ` removed,
// so page modules share one scope and must not reuse top-level names.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = join(root, "src", "page");
const read = (name) => readFileSync(join(page, name), "utf8");

const MODULES = ["view.js", "db.js", "app.js"];
const js = MODULES.map((m) =>
  read(m)
    .replace(/^import .*$/gm, "")
    .replace(/^export (default )?/gm, ""),
).join("\n");

const html = read("index.html")
  .replace("/* @inline-styles */", () => read("styles.css"))
  .replace("/* @inline-script */", () => js.replace(/<\/script/gi, "<\\/script"));

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "todo.html"), html);
console.log(`built dist/todo.html (${html.length} bytes)`);
