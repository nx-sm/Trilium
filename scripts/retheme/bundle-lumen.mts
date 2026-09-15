/**
 * Bundles the Lumen theme into one stylesheet that installs as a user theme (re-theme TDD §7,
 * rollout step 1). A user theme is served from a note download URL, where the relative imports of
 * `theme-lumen.css` cannot resolve, so every import is inlined.
 *
 * Usage: node scripts/retheme/bundle-lumen.mts [--out dist/retheme/lumen-theme.css]
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), "..", "..");
const ENTRY = "apps/client/src/stylesheets/theme-lumen.css";
const DEFAULT_OUTPUT = "dist/retheme/lumen-theme.css";

const HEADER = `/*
 * Lumen, a token theme for Trilium Notes, bundled from ${ENTRY}.
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * To install it as a user theme, create a CSS code note with this content, add the labels
 * #appTheme=lumen-standalone and #appThemeBase=next, and choose it under Settings > Appearance.
 * As a user theme it follows the operating system's colour scheme.
 */

`;

export function main() {
    const { values } = parseArgs({ options: { out: { type: "string", default: DEFAULT_OUTPUT } } });
    const output = resolve(ROOT, values.out ?? DEFAULT_OUTPUT);
    const css = HEADER + inlineImports(join(ROOT, ENTRY), (path) => readFileSync(path, "utf-8"));

    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, css);
    console.log(`Wrote ${relative(ROOT, output)} (${css.length} bytes).`);
}

/**
 * Replaces each `@import url(…)` with the imported file's content, recursively, resolving each path
 * against the file that imports it. A file imported more than once is included the first time only.
 */
export function inlineImports(entry: string, readFile: (path: string) => string, seen = new Set<string>()): string {
    const path = resolve(entry);
    if (seen.has(path)) {
        return "";
    }
    seen.add(path);

    return readFile(path).replace(IMPORT, (_match, target: string) => {
        return inlineImports(resolve(dirname(path), target), readFile, seen).trimEnd();
    });
}

const IMPORT = /@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*;/g;

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
    main();
}
