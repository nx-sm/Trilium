/**
 * Inventories the CSS custom properties that the client defines and consumes, for the re-theme
 * audit in `docs/Retheme/Audit.md`. Writes `docs/Retheme/inventory/css-variables.json` and
 * `css-variables.md`; both are generated, so rerun the script instead of editing them.
 *
 * A definition is a `--name: value` declaration in a stylesheet, or a `setProperty("--name")` /
 * `"--name":` style entry in a script. A use is `var(--name)`, `getPropertyValue("--name")` or
 * `readCssVar(element, "name")`. Spec files and type declarations are skipped.
 *
 * Usage: node scripts/retheme/css-variable-inventory.mts
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), "..", "..");
const SCAN_ROOT = "apps/client/src";
const OUTPUT_DIR = "docs/Retheme/inventory";

/** Stylesheets whose global declarations form the contract that third-party themes override. */
export const THEME_FILES = {
    "light": "apps/client/src/stylesheets/theme-light.css",
    "dark": "apps/client/src/stylesheets/theme-dark.css",
    "next-light": "apps/client/src/stylesheets/theme-next-light.css",
    "next-dark": "apps/client/src/stylesheets/theme-next-dark.css",
    "next-base": "apps/client/src/stylesheets/theme-next/base.css"
} as const;

export type ThemeKey = keyof typeof THEME_FILES;

export interface SourceFile {
    path: string;
    source: string;
}

export interface VariableDefinition {
    name: string;
    file: string;
    line: number;
    selector: string;
    global: boolean;
    value: string;
}

export interface VariableUsage {
    name: string;
    file: string;
    line: number;
}

export interface VariableEntry {
    name: string;
    definitions: VariableDefinition[];
    uses: number;
    usesByFile: Record<string, number>;
    themes: Partial<Record<ThemeKey, string>>;
}

export interface Inventory {
    scanRoot: string;
    totals: {
        variables: number;
        definedGlobally: number;
        definedOnlyLocally: number;
        usedButUndefined: number;
        definedButUnused: number;
        themeContract: number;
    };
    variables: VariableEntry[];
}

export function main() {
    const files = listSourceFiles(join(ROOT, SCAN_ROOT)).map((path) => ({
        path: relative(ROOT, path).split("\\").join("/"),
        source: readFileSync(path, "utf-8")
    }));
    const inventory = buildInventory(files, SCAN_ROOT);

    mkdirSync(join(ROOT, OUTPUT_DIR), { recursive: true });
    writeFileSync(join(ROOT, OUTPUT_DIR, "css-variables.json"), renderJson(inventory));
    writeFileSync(join(ROOT, OUTPUT_DIR, "css-variables.md"), renderMarkdown(inventory));

    const { totals } = inventory;
    console.log(`Scanned ${files.length} files: ${totals.variables} variables, ` +
        `${totals.themeContract} in the theme contract, ${totals.usedButUndefined} used but undefined.`);
}

export function buildInventory(files: SourceFile[], scanRoot: string): Inventory {
    const entries = new Map<string, VariableEntry>();
    const entryFor = (name: string) => {
        let entry = entries.get(name);
        if (!entry) {
            entry = { name, definitions: [], uses: 0, usesByFile: {}, themes: {} };
            entries.set(name, entry);
        }
        return entry;
    };
    const themeByFile = new Map<string, ThemeKey>(
        Object.entries(THEME_FILES).map(([ key, file ]) => [ file, key as ThemeKey ])
    );

    for (const file of files) {
        const { definitions, usages } = extname(file.path) === ".css"
            ? scanStylesheet(file.source, file.path)
            : scanScript(file.source, file.path);

        for (const definition of definitions) {
            const entry = entryFor(definition.name);
            entry.definitions.push(definition);
            const theme = themeByFile.get(definition.file);
            if (theme && definition.global && entry.themes[theme] === undefined) {
                entry.themes[theme] = definition.value;
            }
        }

        for (const usage of usages) {
            const entry = entryFor(usage.name);
            entry.uses++;
            entry.usesByFile[usage.file] = (entry.usesByFile[usage.file] ?? 0) + 1;
        }
    }

    const variables = [ ...entries.values() ].sort((a, b) => a.name.localeCompare(b.name));
    return {
        scanRoot,
        totals: {
            variables: variables.length,
            definedGlobally: variables.filter((v) => v.definitions.some((d) => d.global)).length,
            definedOnlyLocally: variables.filter((v) => v.definitions.length > 0 && v.definitions.every((d) => !d.global)).length,
            usedButUndefined: variables.filter((v) => v.definitions.length === 0).length,
            definedButUnused: variables.filter((v) => v.uses === 0).length,
            themeContract: variables.filter((v) => Object.keys(v.themes).length > 0).length
        },
        variables
    };
}

/** Finds custom property declarations and `var()` references in a stylesheet. */
export function scanStylesheet(source: string, file: string) {
    const text = blankComments(source, "css");
    const lineAt = lineLocator(text);
    const definitions: VariableDefinition[] = [];
    const preludes: string[] = [];
    let statementStart = 0;
    let parenDepth = 0;
    let quote = "";

    for (let i = 0; i < text.length; i++) {
        const ch = text.charAt(i);
        if (quote) {
            if (ch === "\\") {
                i++;
            } else if (ch === quote) {
                quote = "";
            }
            continue;
        }

        if (ch === "\"" || ch === "'") {
            quote = ch;
        } else if (ch === "(") {
            parenDepth++;
        } else if (ch === ")") {
            parenDepth = Math.max(0, parenDepth - 1);
        } else if (parenDepth === 0 && ch === "{") {
            preludes.push(text.slice(statementStart, i).trim());
            statementStart = i + 1;
        } else if (parenDepth === 0 && (ch === ";" || ch === "}")) {
            const match = /^(\s*)(--[\w-]+)\s*:([\s\S]*)$/.exec(text.slice(statementStart, i));
            if (match) {
                const rules = preludes.filter((prelude) => !prelude.startsWith("@"));
                definitions.push({
                    name: match[2] ?? "",
                    file,
                    line: lineAt(statementStart + (match[1]?.length ?? 0)),
                    selector: rules.join(" ") || ":root",
                    global: isGlobalSelector(rules[0] ?? ":root"),
                    value: (match[3] ?? "").trim().replace(/\s+/g, " ")
                });
            }
            if (ch === "}") {
                preludes.pop();
            }
            statementStart = i + 1;
        }
    }

    return { definitions, usages: findReferences(text, file, lineAt) };
}

/** Finds custom properties that TypeScript sets on elements or reads back from computed style. */
export function scanScript(source: string, file: string) {
    const text = blankComments(source, "script");
    const lineAt = lineLocator(text);
    const definitions: VariableDefinition[] = [];

    for (const pattern of [ /setProperty\(\s*["'`](--[\w-]+)["'`]/g, /["'](--[\w-]+)["']\s*:/g ]) {
        for (const match of text.matchAll(pattern)) {
            const index = match.index ?? 0;
            const before = text.slice(Math.max(0, index - 120), index);
            const preceding = before.slice(Math.max(before.lastIndexOf("\n"), before.lastIndexOf(";")) + 1);
            definitions.push({
                name: match[1] ?? "",
                file,
                line: lineAt(index),
                selector: "(script)",
                global: /documentElement|document\.body/.test(preceding),
                value: ""
            });
        }
    }

    const usages = findReferences(text, file, lineAt);
    for (const pattern of [ /getPropertyValue\(\s*["'`](--[\w-]+)["'`]/g, /readCssVar\([^,()]+,\s*["'`]([\w-]+)["'`]/g ]) {
        for (const match of text.matchAll(pattern)) {
            const name = match[1] ?? "";
            usages.push({ name: name.startsWith("--") ? name : `--${name}`, file, line: lineAt(match.index ?? 0) });
        }
    }

    return { definitions, usages };
}

/** True for rules that apply to the whole document: `:root`, `html` or `body`, optionally qualified. */
export function isGlobalSelector(selector: string) {
    return selector.split(",").every((part) => /^(:root|html|body)([.:[#][^\s>+~]*)*$/.test(part.trim()));
}

/**
 * Serialises the inventory with one variable per line, so a regenerated file diffs by variable.
 * Definitions are condensed to `path:line` and keep their value only in a global scope.
 */
export function renderJson(inventory: Inventory) {
    const rows = inventory.variables.map((variable) => JSON.stringify({
        name: variable.name,
        definedAt: variable.definitions.map((d) => `${d.file}:${d.line}`),
        globalValues: Object.fromEntries(variable.definitions
            .filter((d) => d.global && d.value)
            .map((d) => [ `${d.file}:${d.line}`, d.value ])),
        uses: variable.uses,
        usesByFile: variable.usesByFile,
        themes: variable.themes
    }));
    return [
        "{",
        `"scanRoot": ${JSON.stringify(inventory.scanRoot)},`,
        `"totals": ${JSON.stringify(inventory.totals)},`,
        "\"variables\": [",
        rows.join(",\n"),
        "]",
        "}",
        ""
    ].join("\n");
}

export function renderMarkdown(inventory: Inventory) {
    const { totals, variables } = inventory;
    const themeKeys = Object.keys(THEME_FILES) as ThemeKey[];
    const lines = [
        "# CSS custom property inventory",
        "",
        `Generated by \`scripts/retheme/css-variable-inventory.mts\` from \`${inventory.scanRoot}\` ` +
            "(spec files excluded). Do not edit by hand; rerun the script.",
        "",
        "## Totals",
        "",
        "| Measure | Count |",
        "| --- | --- |",
        `| Distinct variables | ${totals.variables} |`,
        `| Defined in a global scope (\`:root\`, \`html\`, \`body\`) | ${totals.definedGlobally} |`,
        `| Defined only in a local scope | ${totals.definedOnlyLocally} |`,
        `| Used but never defined in the client | ${totals.usedButUndefined} |`,
        `| Defined but never used in the client | ${totals.definedButUnused} |`,
        `| Theme contract (declared globally by a built-in theme file) | ${totals.themeContract} |`,
        "",
        "## Theme contract",
        "",
        "Variables that the built-in theme stylesheets declare globally. Third-party themes override " +
            "these names, so the re-theme keeps every one of them as an alias (TDD §3.4).",
        "",
        `| Variable | ${themeKeys.join(" | ")} | Uses |`,
        `| --- | ${themeKeys.map(() => "---").join(" | ")} | --- |`
    ];

    for (const variable of variables.filter((v) => Object.keys(v.themes).length > 0)) {
        const cells = themeKeys.map((key) => formatValue(variable.themes[key]));
        lines.push(`| \`${variable.name}\` | ${cells.join(" | ")} | ${variable.uses} |`);
    }

    lines.push(
        "",
        "## Used but never defined",
        "",
        "Set at runtime, supplied by a vendored library or by the embedding page, or a typo.",
        "",
        "| Variable | Uses | Consumers |",
        "| --- | --- | --- |"
    );
    for (const variable of variables.filter((v) => v.definitions.length === 0)) {
        lines.push(`| \`${variable.name}\` | ${variable.uses} | ${topConsumers(variable, inventory.scanRoot)} |`);
    }

    lines.push(
        "",
        "## All variables",
        "",
        "| Variable | Definitions | Scope | Defined in | Uses | Top consumers |",
        "| --- | --- | --- | --- | --- | --- |"
    );
    for (const variable of variables) {
        const files = [ ...new Set(variable.definitions.map((d) => shortPath(d.file, inventory.scanRoot))) ];
        const scope = variable.definitions.length === 0 ? "—"
            : variable.definitions.some((d) => d.global) ? "global" : "local";
        const definedIn = files.slice(0, 3).join(", ") + (files.length > 3 ? ` +${files.length - 3}` : "");
        lines.push(`| \`${variable.name}\` | ${variable.definitions.length} | ${scope} | ${definedIn || "—"} | ` +
            `${variable.uses} | ${topConsumers(variable, inventory.scanRoot)} |`);
    }

    return `${lines.join("\n")}\n`;
}

function listSourceFiles(directory: string): string[] {
    const result: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            result.push(...listSourceFiles(path));
        } else if (/\.(css|ts|tsx)$/.test(entry.name) && !/\.spec\.tsx?$|\.d\.ts$/.test(entry.name)) {
            result.push(path);
        }
    }
    return result.sort();
}

function findReferences(text: string, file: string, lineAt: (index: number) => number): VariableUsage[] {
    return [ ...text.matchAll(/var\(\s*(--[\w-]+)/g) ].map((match) => ({
        name: match[1] ?? "",
        file,
        line: lineAt(match.index ?? 0)
    }));
}

/** Replaces comment characters with spaces, keeping newlines so offsets still map to lines. */
function blankComments(source: string, syntax: "css" | "script") {
    const chars = source.split("");
    let quote = "";
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const next = chars[i + 1];
        if (quote) {
            if (ch === "\\") {
                i++;
            } else if (ch === quote || (ch === "\n" && quote !== "`")) {
                quote = "";
            }
            continue;
        }

        if (ch === "\"" || ch === "'" || (syntax === "script" && ch === "`")) {
            quote = ch;
        } else if (ch === "/" && next === "*") {
            const end = source.indexOf("*/", i + 2);
            const stop = end === -1 ? chars.length : end + 2;
            blank(chars, i, stop);
            i = stop - 1;
        } else if (syntax === "script" && ch === "/" && next === "/") {
            const end = source.indexOf("\n", i);
            const stop = end === -1 ? chars.length : end;
            blank(chars, i, stop);
            i = stop - 1;
        }
    }
    return chars.join("");
}

function blank(chars: string[], start: number, stop: number) {
    for (let j = start; j < stop; j++) {
        if (chars[j] !== "\n") {
            chars[j] = " ";
        }
    }
}

function lineLocator(text: string) {
    const newlines: number[] = [];
    for (const match of text.matchAll(/\n/g)) {
        newlines.push(match.index ?? 0);
    }
    return (index: number) => {
        let low = 0;
        let high = newlines.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if ((newlines[mid] ?? 0) < index) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return low + 1;
    };
}

function formatValue(value: string | undefined) {
    if (value === undefined) {
        return "";
    }
    const shortened = value.length > 40 ? `${value.slice(0, 37)}…` : value;
    return `\`${shortened.replace(/\|/g, "\\|").replace(/`/g, "'")}\``;
}

function topConsumers(variable: VariableEntry, scanRoot: string) {
    return Object.entries(variable.usesByFile)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([ file, count ]) => `${shortPath(file, scanRoot)} (${count})`)
        .join(", ") || "—";
}

function shortPath(file: string, scanRoot: string) {
    return file.startsWith(`${scanRoot}/`) ? file.slice(scanRoot.length + 1) : file;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
    main();
}
