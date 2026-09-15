/**
 * Builds Lumen's interface icons (re-theme icon inventory, adoption path B): a subset of Tabler Icons
 * drawn at the Boxicons codepoints that `docs/Retheme/inventory/icons.json` maps, and the stylesheet
 * that puts that font in front of Boxicons wherever the app asks for the Boxicons font.
 *
 * Tabler Icons is not a dependency of the repository. Unpack the pinned webfont release first:
 *
 *     npm pack @tabler/icons-webfont@3.46.0 && tar -xzf tabler-icons-webfont-3.46.0.tgz
 *
 * Usage: node scripts/retheme/build-lumen-icons.mts --tabler <path to the unpacked `package` directory>
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { deflateSync } from "node:zlib";

import * as opentypeModule from "opentype.js";

const opentype = opentypeModule.default ?? opentypeModule;

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const ROOT = resolve(dirname(SCRIPT_PATH), "..", "..");

export const TABLER_VERSION = "3.46.0";
export const INVENTORY = "docs/Retheme/inventory/icons.json";
export const BOXICONS_MANIFEST = "packages/trilium-core/src/services/icon_pack_boxicons-v2.json";
export const FONT_OUTPUT = "apps/client/src/fonts/tabler/tabler-icons-lumen.woff";
export const LICENSE_OUTPUT = "apps/client/src/fonts/tabler/LICENSE";
export const CSS_OUTPUT = "apps/client/src/stylesheets/theme-lumen/icons/tabler.css";

/** The family of the subset font. It only has to differ from every family the app declares. */
export const FONT_FAMILY = "lumen-tabler";

/** Inventory grades that switch to Tabler; `none` keeps the Boxicons logo it has no equivalent for. */
const REMAPPED_GRADES = new Set([ "exact", "close", "weak" ]);

/** Directories whose stylesheets can name the Boxicons font while Lumen is active. */
const STYLESHEET_ROOTS = [ "apps/client/src", "packages/ckeditor5/src/theme" ];

/** The print view loads no theme, and Lumen's own stylesheets are the output. */
const STYLESHEET_EXCLUDES = [ "apps/client/src/print.css", "apps/client/src/stylesheets/theme-lumen/" ];

/** A fixed `head.created` date, so that rebuilding from the same inputs writes the same bytes. */
const FONT_TIMESTAMP = Date.UTC(2026, 0, 1) / 1000;

export interface InventoryEntry {
    boxicons: string;
    uses: number;
    tabler: string | null;
    grade: string;
    verified: boolean;
}

export interface BoxiconsManifest {
    metrics: { ascent: number; descent: number };
    icons: Record<string, { glyph: string }>;
}

/** One Tabler glyph and the Boxicons codepoints it replaces. */
export interface GlyphRemap {
    tabler: string;
    tablerCodepoint: number;
    unicodes: number[];
}

/** A declaration that names the Boxicons font, with the selectors and at-rules it applies under. */
export interface FontRule {
    atRules: string[];
    selectors: string[];
    property: string;
    value: string;
    important: boolean;
}

export function main() {
    const { values } = parseArgs({ options: { tabler: { type: "string" } } });
    if (!values.tabler) {
        throw new Error("Pass --tabler with the directory of the unpacked @tabler/icons-webfont package.");
    }
    const tablerDir = resolve(values.tabler);
    const { version } = JSON.parse(readFileSync(join(tablerDir, "package.json"), "utf-8"));
    if (version !== TABLER_VERSION) {
        throw new Error(`Expected @tabler/icons-webfont ${TABLER_VERSION}, found ${version}.`);
    }

    const inventory: InventoryEntry[] = JSON.parse(readFileSync(join(ROOT, INVENTORY), "utf-8"));
    const boxicons: BoxiconsManifest = JSON.parse(readFileSync(join(ROOT, BOXICONS_MANIFEST), "utf-8"));
    const tablerGlyphs = parseTablerGlyphs(readFileSync(join(tablerDir, "dist/tabler-icons.css"), "utf-8"));
    const remaps = resolveRemaps(inventory, boxicons, tablerGlyphs);

    const sfnt = subsetFont(readFileSync(join(tablerDir, "dist/fonts/tabler-icons.ttf")), remaps, boxicons.metrics.ascent - 0.5);
    const woff = sfntToWoff(sfnt);
    const rules = listStylesheets().flatMap((file) => collectBoxiconsFontRules(readFileSync(file, "utf-8")));
    const css = renderIconCss({
        version,
        codepoints: remaps.flatMap((remap) => remap.unicodes),
        metrics: boxicons.metrics,
        fontUrl: relative(dirname(join(ROOT, CSS_OUTPUT)), join(ROOT, FONT_OUTPUT)),
        rules
    });

    for (const [ path, content ] of [
        [ FONT_OUTPUT, woff ],
        [ LICENSE_OUTPUT, readFileSync(join(tablerDir, "LICENSE")) ],
        [ CSS_OUTPUT, css ]
    ] as const) {
        mkdirSync(dirname(join(ROOT, path)), { recursive: true });
        writeFileSync(join(ROOT, path), content);
    }
    const glyphCount = remaps.length;
    const codepointCount = remaps.reduce((count, remap) => count + remap.unicodes.length, 0);
    console.log(`Wrote ${FONT_OUTPUT} (${glyphCount} glyphs for ${codepointCount} Boxicons codepoints, ${woff.length} bytes).`);
    console.log(`Wrote ${CSS_OUTPUT} (${rules.length} stylesheet rules name the Boxicons font).`);
}

/** Reads each `.ti-<name>:before { content: "\hex" }` rule of the Tabler webfont stylesheet. */
export function parseTablerGlyphs(css: string) {
    const glyphs = new Map<string, number>();
    for (const [ , name, hex ] of css.matchAll(/\.ti-([a-z0-9-]+):{1,2}before\s*\{\s*content:\s*"\\([0-9a-f]+)"/g)) {
        glyphs.set(name, parseInt(hex, 16));
    }
    return glyphs;
}

/**
 * Pairs each remapped inventory entry with its Tabler glyph, grouping the Boxicons names that share
 * one. Entries whose Boxicons name is not in the manifest are skipped: nothing renders for them.
 *
 * @throws when the inventory names a Tabler icon that the webfont does not have.
 */
export function resolveRemaps(inventory: InventoryEntry[], boxicons: BoxiconsManifest, tablerGlyphs: Map<string, number>) {
    const remaps = new Map<string, GlyphRemap>();
    const missing: string[] = [];
    for (const entry of inventory) {
        const glyph = boxicons.icons[entry.boxicons]?.glyph;
        if (!entry.tabler || !REMAPPED_GRADES.has(entry.grade) || !glyph) {
            continue;
        }
        const tablerCodepoint = tablerGlyphs.get(entry.tabler);
        if (tablerCodepoint === undefined) {
            missing.push(`${entry.boxicons} → ${entry.tabler}`);
            continue;
        }
        const remap = remaps.get(entry.tabler) ?? { tabler: entry.tabler, tablerCodepoint, unicodes: [] };
        const codepoint = glyphCodepoint(glyph);
        if (!remap.unicodes.includes(codepoint)) {
            remap.unicodes.push(codepoint);
        }
        remaps.set(entry.tabler, remap);
    }
    if (missing.length) {
        throw new Error(`Tabler Icons has no glyph for ${missing.join(", ")}.`);
    }

    return [ ...remaps.values() ]
        .map((remap) => ({ ...remap, unicodes: remap.unicodes.toSorted((a, b) => a - b) }))
        .toSorted((a, b) => a.tabler.localeCompare(b.tabler));
}

/**
 * Copies the remapped glyphs into a new OpenType font, encoded at their Boxicons codepoints and moved
 * vertically so that the middle of their ink sits where Boxicons draws its own.
 *
 * @param bytes a TrueType or OpenType font that `opentype.parse()` reads.
 * @param centre the height of the middle of the Boxicons ink above the baseline, in ems.
 * @returns the subset font as an OpenType (CFF) file.
 */
export function subsetFont(bytes: Uint8Array, remaps: GlyphRemap[], centre: number) {
    const source = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const picked = remaps.map((remap) => {
        const glyph = source.charToGlyph(String.fromCodePoint(remap.tablerCodepoint));
        if (!glyph || glyph.index === 0) {
            throw new Error(`The font has no outline for ${remap.tabler}.`);
        }
        return { remap, glyph };
    });

    const inkCentres = picked
        .map(({ glyph }) => glyph.getBoundingBox())
        .filter((box) => box.y2 > box.y1)
        .map((box) => (box.y1 + box.y2) / 2);
    const shift = Math.round(centre * source.unitsPerEm - median(inkCentres));

    const glyphs = [ new opentype.Glyph({ name: ".notdef", advanceWidth: source.unitsPerEm, path: new opentype.Path() }) ];
    for (const { remap, glyph } of picked) {
        const path = new opentype.Path();
        path.commands = moveOutline(glyph.path.commands, shift);
        glyphs.push(new opentype.Glyph({
            name: remap.tabler.replaceAll("-", "_"),
            unicodes: remap.unicodes,
            advanceWidth: glyph.advanceWidth,
            path
        }));
    }

    const font = new opentype.Font({
        familyName: FONT_FAMILY,
        styleName: "Regular",
        unitsPerEm: source.unitsPerEm,
        ascender: Math.round((0.5 + centre) * source.unitsPerEm),
        descender: -Math.round((0.5 - centre) * source.unitsPerEm),
        copyright: "Tabler Icons, Copyright (c) 2020-2026 Paweł Kuna",
        license: "MIT",
        createdTimestamp: FONT_TIMESTAMP,
        glyphs
    });
    const sfnt = new Uint8Array(font.toArrayBuffer());
    pinModifiedDate(sfnt);
    return sfnt;
}

/**
 * Wraps an OpenType font in WOFF 1.0: each table compressed with zlib, or stored as it is where
 * compression does not make it smaller.
 */
export function sfntToWoff(sfnt: Uint8Array) {
    const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
    const numTables = view.getUint16(4);
    const tables = Array.from({ length: numTables }, (_, index) => {
        const entry = 12 + index * 16;
        const offset = view.getUint32(entry + 8);
        const length = view.getUint32(entry + 12);
        const data = sfnt.subarray(offset, offset + length);
        const compressed = deflateSync(data, { level: 9 });
        return {
            tag: view.getUint32(entry),
            checksum: view.getUint32(entry + 4),
            length,
            stored: compressed.length < length ? compressed : data
        };
    }).toSorted((a, b) => a.tag - b.tag);

    const headerSize = 44 + 20 * numTables;
    const totalSize = pad4(headerSize + tables.reduce((size, table) => size + pad4(table.stored.length), 0));
    const woff = new Uint8Array(totalSize);
    const out = new DataView(woff.buffer);
    out.setUint32(0, 0x774f4646); // "wOFF"
    out.setUint32(4, view.getUint32(0));
    out.setUint32(8, totalSize);
    out.setUint16(12, numTables);
    out.setUint32(16, 12 + 16 * numTables + tables.reduce((size, table) => size + pad4(table.length), 0));
    out.setUint16(20, 1);

    let offset = headerSize;
    for (const [ index, table ] of tables.entries()) {
        const entry = 44 + index * 20;
        out.setUint32(entry, table.tag);
        out.setUint32(entry + 4, offset);
        out.setUint32(entry + 8, table.stored.length);
        out.setUint32(entry + 12, table.length);
        out.setUint32(entry + 16, table.checksum);
        woff.set(table.stored, offset);
        offset += pad4(table.stored.length);
    }
    return woff;
}

/** The client and editor stylesheets to scan for rules that name the Boxicons font. */
export function listStylesheets() {
    const files: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            const repoPath = relative(ROOT, path) + (entry.isDirectory() ? "/" : "");
            if (entry.name === "node_modules" || STYLESHEET_EXCLUDES.some((exclude) => repoPath.startsWith(exclude))) {
                continue;
            }
            if (entry.isDirectory()) {
                walk(path);
            } else if (entry.name.endsWith(".css")) {
                files.push(path);
            }
        }
    };
    for (const root of STYLESHEET_ROOTS) {
        walk(join(ROOT, root));
    }
    return files.toSorted();
}

/**
 * Finds every `font-family` (or `--task-state-glyph-font-family`) declaration that lists Boxicons, and
 * returns it with its nesting flattened and `lumen-tabler` inserted in front of Boxicons.
 */
export function collectBoxiconsFontRules(css: string) {
    const rules: FontRule[] = [];
    const stack: string[] = [];
    const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
    let buffer = "";
    for (let index = 0; index < source.length; index++) {
        const char = source[index];
        if (char === "\"" || char === "'") {
            const end = source.indexOf(char, index + 1);
            buffer += source.slice(index, end + 1);
            index = end;
        } else if (char === "{") {
            stack.push(buffer.trim());
            buffer = "";
        } else if (char === ";" || char === "}") {
            const rule = toFontRule(stack, buffer);
            if (rule) {
                rules.push(rule);
            }
            buffer = "";
            if (char === "}") {
                stack.pop();
            }
        } else {
            buffer += char;
        }
    }
    return rules;
}

/**
 * Raises a selector above the rule it copies: `html:root` adds one class and one element to its
 * specificity, as in the rest of Lumen.
 */
export function liftSelector(selector: string) {
    if (selector.startsWith(":root")) {
        return `html${selector}`;
    }
    if (/^html(?![\w-])/.test(selector)) {
        return `html:root${selector.slice(4)}`;
    }
    return `html:root ${selector}`;
}

/** Writes codepoints as a `unicode-range` value, joining consecutive ones into ranges. */
export function unicodeRange(codepoints: number[]) {
    const sorted = [ ...new Set(codepoints) ].toSorted((a, b) => a - b);
    const ranges: string[] = [];
    for (let index = 0; index < sorted.length; index++) {
        const start = sorted[index];
        while (sorted[index + 1] === sorted[index] + 1) {
            index++;
        }
        const hex = (codepoint: number) => codepoint.toString(16).toUpperCase();
        ranges.push(sorted[index] === start ? `U+${hex(start)}` : `U+${hex(start)}-${hex(sorted[index])}`);
    }
    return ranges;
}

/** Renders the lifted copies of the stylesheet rules, one per distinct rule. */
export function renderFontRules(rules: FontRule[]) {
    const rendered = rules.map((rule) => {
        const selectors = rule.selectors.map(liftSelector).join(",\n");
        let block = `${selectors} {\n    ${rule.property}: ${rule.value}${rule.important ? " !important" : ""};\n}`;
        for (const atRule of rule.atRules.toReversed()) {
            block = `${atRule} {\n${indent(block)}\n}`;
        }
        return block;
    });
    return [ ...new Set(rendered) ];
}

export function renderIconCss({ version, codepoints, metrics, fontUrl, rules }: {
    version: string;
    codepoints: number[];
    metrics: BoxiconsManifest["metrics"];
    fontUrl: string;
    rules: FontRule[];
}) {
    const percentage = (value: number) => `${Number((value * 100).toFixed(2))}%`;
    const range = wrapList(unicodeRange(codepoints), "    unicode-range: ", 100);
    return `/*
 * Generated by scripts/retheme/build-lumen-icons.mts from ${INVENTORY}; do not edit.
 *
 * Tabler Icons ${version} (MIT; fonts/tabler/LICENSE), cut down to the glyphs that the inventory maps
 * and drawn at the codepoints of the Boxicons glyphs they replace. The face covers only those
 * codepoints, so every other glyph still comes from Boxicons.
 *
 * The icon pack stylesheet loads after the theme, and the face checked first among same-family faces
 * is the last one defined, so this font takes its own family and goes in front of Boxicons in each
 * font-family list instead. Its metrics match Boxicons, which stays the first available font.
 */

@font-face {
    font-family: "${FONT_FAMILY}";
    font-style: normal;
    font-weight: normal;
    font-display: block;
    src: url(${fontUrl}) format("woff");
${range};
    ascent-override: ${percentage(metrics.ascent)};
    descent-override: ${percentage(metrics.descent)};
    line-gap-override: 0%;
}

/* The \`.bx\` rule that the icon pack service generates. */
html:root .bx {
    font-family: "${FONT_FAMILY}", boxicons !important;
}

/* Stylesheet rules that name the Boxicons font themselves. */
${renderFontRules(rules).join("\n\n")}
`;
}

function toFontRule(stack: string[], declaration: string): FontRule | undefined {
    const match = /^\s*(font-family|--task-state-glyph-font-family)\s*:\s*([\s\S]+?)\s*(!important)?\s*$/i.exec(declaration);
    if (!match) {
        return undefined;
    }
    const families = splitTopLevel(match[2]);
    const isBoxicons = (family: string) => family.replace(/^["']|["']$/g, "").toLowerCase() === "boxicons";
    const selectorPreludes = stack.filter((prelude) => !prelude.startsWith("@"));
    if (!families.some(isBoxicons) || !selectorPreludes.length) {
        return undefined;
    }

    return {
        atRules: stack.filter((prelude) => prelude.startsWith("@")),
        selectors: flattenSelectors(selectorPreludes),
        property: match[1].toLowerCase(),
        value: families.flatMap((family) => isBoxicons(family) ? [ `"${FONT_FAMILY}"`, family ] : [ family ]).join(", "),
        important: Boolean(match[3])
    };
}

/** Resolves nested rule preludes into complete selectors, as CSS nesting does for `&` and descendants. */
function flattenSelectors(preludes: string[]) {
    let selectors = [ "" ];
    for (const prelude of preludes) {
        const parts = splitTopLevel(prelude);
        selectors = selectors.flatMap((parent) => parts.map((part) => {
            if (!parent) {
                return part;
            }
            return part.includes("&") ? part.replaceAll("&", parent) : `${parent} ${part}`;
        }));
    }
    return selectors;
}

/** Splits on commas that are not inside parentheses or brackets. */
function splitTopLevel(list: string) {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const char of list) {
        if (char === "(" || char === "[") {
            depth++;
        } else if (char === ")" || char === "]") {
            depth--;
        }
        if (char === "," && depth === 0) {
            parts.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    parts.push(current);
    return parts.map((part) => part.trim().replace(/\s+/g, " ")).filter(Boolean);
}

function glyphCodepoint(glyph: string) {
    const escaped = /^\\([0-9a-f]+)$/i.exec(glyph);
    return escaped ? parseInt(escaped[1], 16) : (glyph.codePointAt(0) ?? 0);
}

type OutlineCommand = { type: string } & Partial<Record<"x" | "y" | "x1" | "y1" | "x2" | "y2", number>>;

/**
 * Moves an outline up by `shift` font units and rounds it to whole units, writing each quadratic
 * curve as the cubic curve CFF stores. Whole-unit points encode as short integers in CFF, where
 * the thirds of a converted control point would take a real number each.
 */
function moveOutline(commands: OutlineCommand[], shift: number) {
    const moved: OutlineCommand[] = [];
    let current = { x: 0, y: 0 };
    let start = current;
    for (const command of commands) {
        const x = command.x ?? 0;
        const y = command.y ?? 0;
        if (command.type === "Q") {
            const x1 = command.x1 ?? 0;
            const y1 = command.y1 ?? 0;
            moved.push({
                type: "C",
                x1: Math.round(current.x + (2 / 3) * (x1 - current.x)),
                y1: Math.round(current.y + (2 / 3) * (y1 - current.y) + shift),
                x2: Math.round(x + (2 / 3) * (x1 - x)),
                y2: Math.round(y + (2 / 3) * (y1 - y) + shift),
                x: Math.round(x),
                y: Math.round(y + shift)
            });
        } else {
            const copy: OutlineCommand = { type: command.type };
            for (const key of [ "x", "y", "x1", "y1", "x2", "y2" ] as const) {
                const value = command[key];
                if (value !== undefined) {
                    copy[key] = Math.round(value + (key.startsWith("y") ? shift : 0));
                }
            }
            moved.push(copy);
        }

        if (command.type === "Z") {
            current = start;
        } else {
            current = { x, y };
            if (command.type === "M") {
                start = current;
            }
        }
    }
    return moved;
}

function median(values: number[]) {
    const sorted = values.toSorted((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Copies `head.created` over `head.modified`, which `opentype.js` stamps with the current time, then
 * updates the `head` checksum and the font's `checkSumAdjustment`.
 */
function pinModifiedDate(sfnt: Uint8Array) {
    const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
    const entry = Array.from({ length: view.getUint16(4) }, (_, index) => 12 + index * 16)
        .find((candidate) => view.getUint32(candidate) === 0x68656164); // "head"
    if (entry === undefined) {
        throw new Error("The font has no head table.");
    }
    const offset = view.getUint32(entry + 8);
    const length = view.getUint32(entry + 12);
    sfnt.copyWithin(offset + 28, offset + 20, offset + 28);
    view.setUint32(offset + 8, 0);
    view.setUint32(entry + 4, checksum(sfnt.subarray(offset, offset + length)));
    view.setUint32(offset + 8, (0xb1b0afba - checksum(sfnt)) >>> 0);
}

/** The OpenType checksum: the sum of the data as big-endian 32-bit words, zero-padded. */
function checksum(data: Uint8Array) {
    let sum = 0;
    for (let index = 0; index < data.length; index += 4) {
        const word = ((data[index] << 24) | ((data[index + 1] ?? 0) << 16) | ((data[index + 2] ?? 0) << 8) | (data[index + 3] ?? 0)) >>> 0;
        sum = (sum + word) >>> 0;
    }
    return sum;
}

function pad4(length: number) {
    return (length + 3) & ~3;
}

function indent(block: string) {
    return block.split("\n").map((line) => `    ${line}`).join("\n");
}

function wrapList(items: string[], prefix: string, width: number) {
    const lines: string[] = [];
    let line = prefix;
    for (const [ index, item ] of items.entries()) {
        const text = `${item}${index < items.length - 1 ? "," : ""}`;
        if (line.length + text.length + 1 > width && line.trim() !== prefix.trim()) {
            lines.push(line.trimEnd());
            line = " ".repeat(prefix.length);
        }
        line += `${text} `;
    }
    lines.push(line.trimEnd());
    return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
    main();
}
