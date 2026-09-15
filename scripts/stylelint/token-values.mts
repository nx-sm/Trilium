/**
 * Stylelint rule `trilium/token-values`: rejects hard-coded colours, font sizes and spacing, so that
 * re-theme CSS reads design tokens instead (re-theme TDD §6.1). `apps/client/.stylelintrc.json`
 * enables it for the Lumen stylesheets, except the primitives, which is where raw values belong.
 *
 * Widths, heights and border widths are allowed: several of them are geometry that JS measures
 * (`docs/Retheme/Selector coupling.md`), not design scale.
 */

import stylelint, { type Rule } from "stylelint";

const { createPlugin, utils: { report, ruleMessages, validateOptions } } = stylelint;

export const ruleName = "trilium/token-values";

export const messages = ruleMessages(ruleName, {
    color: (property: string, value: string) => `Use a colour token instead of "${value}" in "${property}".`,
    fontSize: (property: string, value: string) => `Use a type token instead of "${value}" in "${property}".`,
    spacing: (property: string, value: string) => `Use a spacing token instead of "${value}" in "${property}".`
});

const rule: Rule = (enabled) => (root, result) => {
    if (!validateOptions(result, ruleName, { actual: enabled, possible: [ true ] })) {
        return;
    }

    root.walkDecls((declaration) => {
        const problem = findProblem(declaration.prop, declaration.value);
        if (problem) {
            report({ result, ruleName, node: declaration, message: problem.message, word: problem.literal });
        }
    });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default createPlugin(ruleName, rule);

/** Returns the first hard-coded design value in a declaration, or `undefined` when it reads tokens. */
export function findProblem(property: string, value: string): { message: string; literal: string } | undefined {
    const bare = stripLiterals(value);

    const color = COLOR.exec(bare)?.[0];
    if (color) {
        return { message: messages.color(property, color), literal: color };
    }

    const name = property.toLowerCase();
    const length = firstNonZeroLength(bare);
    if (!length) {
        return undefined;
    }
    if (name === "font-size" || name === "font") {
        return { message: messages.fontSize(property, length), literal: length };
    }
    if (SPACING_PROPERTY.test(name)) {
        return { message: messages.spacing(property, length), literal: length };
    }
    return undefined;
}

const NAMED_COLORS = [
    "black", "white", "red", "green", "blue", "gray", "grey", "silver", "orange", "yellow", "purple", "pink",
    "brown", "navy", "teal", "maroon", "olive", "lime", "aqua", "fuchsia", "cyan", "magenta", "gold", "indigo", "violet"
];

const COLOR = new RegExp(
    `#[0-9a-f]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(|(?<![\\w-])(?:${NAMED_COLORS.join("|")})(?![\\w-])`,
    "i"
);

const SPACING_PROPERTY = /^(?:margin|padding|gap|row-gap|column-gap|inset)(?:-|$)/;

/** Drops `url(…)` and quoted strings, whose contents are not design values. */
function stripLiterals(value: string) {
    return value
        .replace(/url\((?:[^()"']|"[^"]*"|'[^']*')*\)/gi, " ")
        .replace(/"[^"]*"|'[^']*'/g, " ");
}

function firstNonZeroLength(value: string) {
    for (const match of value.matchAll(/(?<![\w.-])(\d*\.?\d+)(?:px|rem|em|pt)\b/gi)) {
        if (Number(match[1]) !== 0) {
            return match[0];
        }
    }
    return undefined;
}
