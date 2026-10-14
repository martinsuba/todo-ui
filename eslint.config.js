import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "node_modules/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2025, sourceType: "module", globals: globals.node },
  },
  {
    files: ["src/page/**/*.js", "test/fake-claude.js"],
    languageOptions: { globals: { ...globals.browser, createFakeClaude: "writable" } },
  },
  {
    files: ["tests/acceptance/*.spec.js", "test/page-helpers.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // page modules are concatenated into one script by scripts/build.mjs, so the
    // names they share look "unused" or "undefined" to a per-file linter
    files: ["src/page/*.js"],
    rules: { "no-unused-vars": "off", "no-undef": "off" },
  },
];
