import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { createLumenTheme, lumenHighlightStyle, lumenThemeSpec } from "./lumen.js";

describe("Lumen editor theme", () => {
    it("sets CodeMirror's dark flag from the variant", () => {
        for (const [ variant, dark ] of [ [ "light", false ], [ "dark", true ] ] as const) {
            const state = EditorState.create({ doc: "x", extensions: [ createLumenTheme(variant) ] });
            expect(state.facet(EditorView.darkTheme), variant).toBe(dark);
        }
    });

    it("reads the chrome from Lumen tokens, falling back to Trilium theme variables", () => {
        const spec = lumenThemeSpec("light");

        expect(spec["&"]).toEqual({
            color: "var(--text-primary, var(--main-text-color))",
            backgroundColor: "var(--surface-base, var(--main-background-color))"
        });
        expect(spec[".cm-tooltip"].border).toBe("1px solid var(--border-subtle, var(--main-border-color))");
        expect(spec[".cm-searchMatch"].backgroundColor).toBe("var(--state-warning-subtle, rgb(249 176 36 / 0.18))");
        expect(lumenThemeSpec("dark")[".cm-searchMatch"].backgroundColor).toBe("var(--state-warning-subtle, rgb(252 201 77 / 0.14))");
    });

    it("colours syntax through the --code-* tokens with a per-variant fallback palette", () => {
        const light = lumenHighlightStyle("light").module?.getRules() ?? "";
        const dark = lumenHighlightStyle("dark").module?.getRules() ?? "";

        expect(light).toContain("var(--code-keyword, #6a47d4)");
        expect(light).toContain("var(--code-string, #19673c)");
        expect(light).toContain("font-style: italic");
        expect(dark).toContain("var(--code-keyword, #b9a3f7)");
        expect(dark).toContain("var(--state-danger, #f6a3a3)");
    });
});
