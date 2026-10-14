// Serialise parsed lines back to text, plus line-level edit helpers (used by apply, T-005).
// All helpers are pure: they return a new array and never touch unrelated lines.

import { readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const SECTION_RE = /^##\s+(.*?)\s*\r?$/;

/**
 * Unchanged lines give back the exact input bytes (including a missing trailing newline).
 * @param {string[]} lines
 */
export function serialize(lines) {
  return lines.join("\n");
}

/**
 * @param {string[]} lines
 * @param {number} index
 * @param {string} text replacement line (without "\n")
 */
export function replaceLine(lines, index, text) {
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) {
    throw new RangeError(`no line at index ${index}`);
  }
  const out = lines.slice();
  out[index] = text;
  return out;
}

/**
 * Moves line `index` to the end of section `name` (after its last non-blank line). Creates the
 * `## name` section at the end of the file if it is missing. Returns the new lines and the line's new index.
 * @param {string[]} lines
 * @param {number} index
 * @param {string} name
 * @returns {{lines: string[], index: number}}
 */
export function moveLineToSection(lines, index, name) {
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) {
    throw new RangeError(`no line at index ${index}`);
  }
  const moved = lines[index];
  const out = lines.slice();
  out.splice(index, 1);

  const heading = out.findIndex(
    (l) => SECTION_RE.exec(l)?.[1].toLowerCase() === name.toLowerCase(),
  );
  if (heading >= 0) {
    let end = out.length;
    for (let i = heading + 1; i < out.length; i++) {
      if (SECTION_RE.test(out[i])) {
        end = i;
        break;
      }
    }
    let at = end;
    while (at > heading + 1 && out[at - 1].trim() === "") at--;
    out.splice(at, 0, moved);
    return { lines: out, index: at };
  }

  // Append a new section; keep the file's trailing-newline state.
  const hadNewline = out.length > 0 && out[out.length - 1] === "";
  if (hadNewline) out.pop();
  if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
  out.push(`## ${name}`, moved);
  const at = out.length - 1;
  if (hadNewline) out.push("");
  return { lines: out, index: at };
}

/**
 * Inserts `block` into section `name` at its top (right after the heading) or at its end (after the last
 * non-blank line). A missing section is created: before section `beforeSection` if that exists, else at the end.
 * `lines` must end with the "" element of a trailing newline. `cr` is "\r" for CRLF files, else "".
 * @param {string[]} lines
 * @param {string} name
 * @param {string[]} block
 * @param {{where: "top"|"end", beforeSection?: string, cr?: string}} opts
 * @returns {string[]}
 */
export function insertIntoSection(lines, name, block, { where, beforeSection, cr = "" }) {
  if (block.length === 0) return lines;
  const find = (/** @type {string} */ n) =>
    lines.findIndex((l) => SECTION_RE.exec(l)?.[1].toLowerCase() === n.toLowerCase());
  const out = lines.slice();
  const heading = find(name);
  if (heading >= 0) {
    let at = heading + 1;
    if (where === "end") {
      let end = out.length;
      for (let i = heading + 1; i < out.length; i++) {
        if (SECTION_RE.test(out[i])) {
          end = i;
          break;
        }
      }
      at = end;
      while (at > heading + 1 && out[at - 1].trim() === "") at--;
    }
    out.splice(at, 0, ...block);
    return out;
  }
  const before = beforeSection ? find(beforeSection) : -1;
  const at = before >= 0 ? before : Math.max(out.length - 1, 0);
  /** @type {string[]} */
  const created = [];
  if (at > 0 && out[at - 1].trim() !== "") created.push(cr);
  created.push(`## ${name}${cr}`, ...block);
  if (before >= 0) created.push(cr);
  out.splice(at, 0, ...created);
  return out;
}

/**
 * Writes `text` to `file` via a temp file in the same directory and a rename. Right before the rename the file
 * is re-read; if it differs from `original` nothing is written and an error is thrown.
 * @param {string} file
 * @param {Buffer} original bytes read at the start
 * @param {string} text new content
 * @param {{beforeCommit?: () => void}} [opts] test hook, runs between the temp write and the re-check
 */
export function writeFileAtomic(file, original, text, { beforeCommit } = {}) {
  const target = realpathSync(file);
  const tmp = join(dirname(target), `.${basename(target)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, text, { mode: statSync(target).mode & 0o7777 });
    beforeCommit?.();
    if (!readFileSync(target).equals(original)) {
      throw new Error(`${file} changed while syncing; nothing was written`);
    }
    renameSync(tmp, target);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
