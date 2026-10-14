// Serialise parsed lines back to text, plus line-level edit helpers (used by apply, T-005).
// All helpers are pure: they return a new array and never touch unrelated lines.

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
