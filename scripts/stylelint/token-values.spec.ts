import stylelint from "stylelint";
import { describe, expect, it } from "vitest";

import plugin, { findProblem, ruleName } from "./token-values.mjs";

describe("findProblem", () => {
    it("rejects raw colours, font sizes and spacing, naming the literal", () => {
        const cases: [ string, string, string ][] = [
            [ "color", "#fff", "#fff" ],
            [ "background", "rgb(0 0 0 / 0.1)", "rgb(" ],
            [ "border-color", "white", "white" ],
            [ "--local-tint", "oklch(70% 0.1 200)", "oklch(" ],
            [ "box-shadow", "0 1px 2px var(--shadow-color), 0 0 0 1px black", "black" ],
            [ "font-size", "13px", "13px" ],
            [ "font", "600 0.8rem/1.2 var(--font-ui)", "0.8rem" ],
            [ "padding-inline", "var(--space-sm) 12px", "12px" ],
            [ "margin", "calc(100% - 2px)", "2px" ],
            [ "gap", "1.5em", "1.5em" ]
        ];

        for (const [ property, value, literal ] of cases) {
            expect(findProblem(property, value)?.literal, `${property}: ${value}`).toBe(literal);
        }
    });

    it("accepts tokens, keywords, zero lengths, literals in strings, and geometry", () => {
        const cases: [ string, string ][] = [
            [ "color", "var(--text-primary)" ],
            [ "background", "color-mix(in srgb, var(--surface-overlay) 88%, transparent)" ],
            [ "color", "currentColor" ],
            [ "padding", "0" ],
            [ "margin", "0px auto" ],
            [ "border", "1px solid var(--border-subtle)" ],
            [ "width", "240px" ],
            [ "background-image", "url(\"data:image/svg+xml,<svg fill='#fff' width='12px'/>\")" ],
            [ "font-family", "\"Blue Sans\", var(--font-ui)" ],
            [ "animation-name", "gold-pulse" ],
            [ "white-space", "nowrap" ],
            [ "font-size", "var(--text-size-ui)" ]
        ];

        for (const [ property, value ] of cases) {
            expect(findProblem(property, value), `${property}: ${value}`).toBeUndefined();
        }
    });
});

describe(ruleName, () => {
    it("reports each offending declaration through stylelint", async () => {
        const { results } = await stylelint.lint({
            code: ".a {\n    color: #123456;\n    padding: var(--space-sm);\n    margin-block: 4px;\n}\n",
            config: { plugins: [ plugin ], rules: { [ruleName]: true } }
        });

        const warnings = results[0]?.warnings ?? [];
        expect(warnings.map((warning) => [ warning.rule, warning.line ])).toEqual([
            [ ruleName, 2 ],
            [ ruleName, 4 ]
        ]);
    });
});
