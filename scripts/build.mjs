// Inlines src/page/styles.css and the page JS modules into src/page/index.html -> dist/todo.html.
// Modules are concatenated into one classic script: static `import` statements (also multi-line) are dropped
// and `export ` removed, so page modules share one scope and must not reuse top-level names.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = join(root, "src", "page");
const read = (name) => readFileSync(join(page, name), "utf8");

export const MODULES = ["view.js", "db.js", "app.js"];

/** Transform one ES module source into a classic-script fragment. */
export function stripModule(source) {
  return source
    .replace(/^import\s[\s\S]*?\sfrom\s+["'][^"']+["'];?[ \t]*$/gm, "")
    .replace(/^import\s+["'][^"']+["'];?[ \t]*$/gm, "")
    .replace(/^export (default )?/gm, "");
}

/** Concatenate module sources into one script; throws if the result is not a plain, parseable script. */
export function bundle(sources) {
  const js = sources.map(stripModule).join("\n");
  const left = js.split("\n").find((l) => /^\s*(import|export)\b/.test(l));
  if (left !== undefined) {
    throw new Error(`build: unsupported import/export left in bundle: ${left.trim()}`);
  }
  try {
    new vm.Script(js);
  } catch (e) {
    throw new Error(`build: bundled script does not parse: ${/** @type {Error} */ (e).message}`, {
      cause: e,
    });
  }
  return js;
}

function main() {
  const js = bundle(MODULES.map(read));
  const html = read("index.html")
    .replace("/* @inline-styles */", () => read("styles.css"))
    .replace("/* @inline-script */", () => js.replace(/<\/script/gi, "<\\/script"));
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist", "todo.html"), html);
  console.log(`built dist/todo.html (${html.length} bytes)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
