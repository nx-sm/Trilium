import { describe, expect, it } from "vitest";

import { buildInventory, isGlobalSelector, renderMarkdown, scanScript, scanStylesheet, THEME_FILES } from "./css-variable-inventory.mjs";

describe("scanStylesheet", () => {
    it("records declarations with their selector, scope and line, and ignores commented-out code", () => {
        const css = [
            ":root {",
            "    --main-color: red;",
            "    /* --commented-out: blue; var(--ghost) */",
            "    --arrow: url(\"data:image/svg+xml;utf8,<svg/>\");",
            "}",
            "@media (prefers-color-scheme: dark) {",
            "    :root:not([data-theme=\"light\"]) { --main-color: black }",
            "}",
            ".tree {",
            "    --row-height: 24px;",
            "    & .row { color: var(--main-color, var(--fallback)); }",
            "}"
        ].join("\n");

        const { definitions, usages } = scanStylesheet(css, "a.css");

        expect(definitions.map(({ name, line, global, selector }) => ({ name, line, global, selector }))).toEqual([
            { name: "--main-color", line: 2, global: true, selector: ":root" },
            { name: "--arrow", line: 4, global: true, selector: ":root" },
            { name: "--main-color", line: 7, global: true, selector: ":root:not([data-theme=\"light\"])" },
            { name: "--row-height", line: 10, global: false, selector: ".tree" }
        ]);
        expect(definitions[1]?.value).toBe("url(\"data:image/svg+xml;utf8,<svg/>\")");
        expect(usages.map(({ name, line }) => [ name, line ])).toEqual([
            [ "--main-color", 11 ],
            [ "--fallback", 11 ]
        ]);
    });
});

describe("scanScript", () => {
    it("reads setProperty, style objects, getPropertyValue and readCssVar, skipping comments", () => {
        const ts = [
            "// readCssVar(document.body, \"commented\")",
            "document.documentElement.style.setProperty(\"--zoom\", \"1\");",
            "el.style.setProperty(\"--local\", value);",
            "const style = { \"--hue\": hue };",
            "const url = \"https://example.com\"; readCssVar(document.body, \"theme-style\");",
            "getComputedStyle(el).getPropertyValue(\"--tab-note-icons\");",
            "const css = `width: var(--width)`;"
        ].join("\n");

        const { definitions, usages } = scanScript(ts, "a.ts");

        expect(definitions.map(({ name, global, line }) => [ name, global, line ])).toEqual([
            [ "--zoom", true, 2 ],
            [ "--local", false, 3 ],
            [ "--hue", false, 4 ]
        ]);
        expect(usages.map(({ name, line }) => [ name, line ])).toEqual([
            [ "--width", 7 ],
            [ "--tab-note-icons", 6 ],
            [ "--theme-style", 5 ]
        ]);
    });
});

describe("isGlobalSelector", () => {
    it("accepts qualified root selectors and rejects descendants", () => {
        expect(isGlobalSelector(":root")).toBe(true);
        expect(isGlobalSelector("html, body.mobile")).toBe(true);
        expect(isGlobalSelector(":root[data-theme=\"dark\"]")).toBe(true);
        expect(isGlobalSelector("body .tree")).toBe(false);
        expect(isGlobalSelector(".modal")).toBe(false);
    });
});

describe("buildInventory", () => {
    it("aggregates definitions and uses, and maps theme contract values per theme file", () => {
        const inventory = buildInventory([
            { path: THEME_FILES.light, source: "html { --main-color: white; }" },
            { path: THEME_FILES["next-dark"], source: ":root { --main-color: #111; } .x { --main-color: red; }" },
            { path: "apps/client/src/widgets/a.css", source: ".a { color: var(--main-color); border-color: var(--unset-var); }" }
        ], "apps/client/src");

        const main = inventory.variables.find((v) => v.name === "--main-color");
        expect(main?.themes).toEqual({ "light": "white", "next-dark": "#111" });
        expect(main?.definitions).toHaveLength(3);
        expect(main?.usesByFile).toEqual({ "apps/client/src/widgets/a.css": 1 });
        expect(inventory.totals).toEqual({
            variables: 2,
            definedGlobally: 1,
            definedOnlyLocally: 0,
            usedButUndefined: 1,
            definedButUnused: 0,
            themeContract: 1
        });

        const markdown = renderMarkdown(inventory);
        expect(markdown).toContain("| `--main-color` | `white` |  |  | `#111` |  | 1 |");
        expect(markdown).toContain("| `--unset-var` | 1 | widgets/a.css (1) |");
    });
});
