/**
 * Bundles the Lumen theme into one stylesheet that installs as a user theme (re-theme TDD §7,
 * rollout step 1). A user theme is served from a note download URL, where the relative imports and
 * font URLs of `theme-lumen.css` cannot resolve, so every import is inlined and every font embedded.
 *
 * Usage: node scripts/retheme/bundle-lumen.mts [--out dist/retheme/lumen-theme.css]
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
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
 *
 * Its interface icons embed a subset of Tabler Icons: MIT License, Copyright (c) 2020-2026 Paweł Kuna.
 */

`;

export interface BundleReader {
    readFile: (path: string) => string;
    /** Reads a file that a `url()` names, to embed it as a data URL. Without it, URLs stay as written. */
    readBinary?: (path: string) => Uint8Array;
}

export function main() {
    const { values } = parseArgs({ options: { out: { type: "string", default: DEFAULT_OUTPUT } } });
    const output = resolve(ROOT, values.out ?? DEFAULT_OUTPUT);
    const css = HEADER + inlineImports(join(ROOT, ENTRY), {
        readFile: (path) => readFileSync(path, "utf-8"),
        readBinary: (path) => readFileSync(path)
    });

    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, css);
    console.log(`Wrote ${relative(ROOT, output)} (${css.length} bytes).`);
}

/**
 * Replaces each `@import url(…)` with the imported file's content, recursively, resolving each path
 * against the file that imports it. A file imported more than once is included the first time only.
 */
export function inlineImports(entry: string, reader: BundleReader, seen = new Set<string>()): string {
    const path = resolve(entry);
    if (seen.has(path)) {
        return "";
    }
    seen.add(path);

    const css = reader.readBinary ? embedUrls(reader.readFile(path), dirname(path), reader.readBinary) : reader.readFile(path);
    return css.replace(IMPORT, (_match, target: string) => {
        return inlineImports(resolve(dirname(path), target), reader, seen).trimEnd();
    });
}

/**
 * Replaces each relative `url()` outside an `@import` with a data URL of the file it names.
 *
 * @throws for a file type the theme is not expected to reference.
 */
export function embedUrls(css: string, baseDir: string, readBinary: (path: string) => Uint8Array) {
    return css.replace(URL_REFERENCE, (match, target: string) => {
        if (/^(data:|[a-z]+:\/\/|#)/i.test(target)) {
            return match;
        }
        const mediaType = MEDIA_TYPES[extname(target).toLowerCase()];
        if (!mediaType) {
            throw new Error(`No media type for ${target}.`);
        }
        return `url(data:${mediaType};base64,${Buffer.from(readBinary(resolve(baseDir, target))).toString("base64")})`;
    });
}

const IMPORT = /@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*;/g;
const URL_REFERENCE = /(?<!@import\s+)url\(\s*["']?([^"')]+)["']?\s*\)/g;
const MEDIA_TYPES: Record<string, string> = { ".woff": "font/woff", ".woff2": "font/woff2" };

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
    main();
}
