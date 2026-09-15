import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export type LumenVariant = "light" | "dark";

/** Syntax colour roles, each read from the `--code-<role>` token of the Lumen app theme. */
export type SyntaxRole = "keyword" | "string" | "number" | "function" | "type" | "property" | "comment"
    | "punctuation" | "heading" | "link";

/**
 * Builds the Lumen editor theme. Colours are custom properties of the Lumen app theme
 * (`apps/client/src/stylesheets/theme-lumen/tokens/semantic.css`), so the editor follows the app's
 * colour scheme live. Each falls back to a Trilium theme variable, or for syntax colours to the same
 * palette as a literal, so the editor stays readable under another app theme.
 */
export function createLumenTheme(variant: LumenVariant): Extension {
    return [
        EditorView.theme(lumenThemeSpec(variant), { dark: variant === "dark" }),
        syntaxHighlighting(lumenHighlightStyle(variant))
    ];
}

/** The editor chrome: background, caret, selection, gutters, active line, tooltips. */
export function lumenThemeSpec(variant: LumenVariant) {
    const text = token("--text-primary", "var(--main-text-color)");
    return {
        "&": {
            color: text,
            backgroundColor: token("--surface-base", "var(--main-background-color)")
        },
        ".cm-content": {
            caretColor: token("--accent-default", "currentColor")
        },
        ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: token("--accent-default", "currentColor")
        },
        "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
            backgroundColor: token("--selection-background", "var(--selection-background-color)")
        },
        ".cm-activeLine": {
            backgroundColor: token("--state-hover", "transparent")
        },
        ".cm-gutters": {
            border: "none",
            backgroundColor: "transparent",
            color: token("--text-tertiary", "var(--muted-text-color)")
        },
        ".cm-activeLineGutter": {
            backgroundColor: "transparent",
            color: text
        },
        "&.cm-focused .cm-matchingBracket": {
            outline: `1px solid ${token("--accent-default", "currentColor")}`,
            backgroundColor: token("--accent-subtle", "transparent")
        },
        ".cm-searchMatch": {
            backgroundColor: token("--state-warning-subtle", SEARCH_MATCH_FALLBACKS[variant])
        },
        ".cm-tooltip": {
            border: `1px solid ${token("--border-subtle", "var(--main-border-color)")}`,
            borderRadius: token("--radius-control", "6px"),
            backgroundColor: token("--surface-overlay", "var(--menu-background-color-no-backdrop)"),
            color: text
        },
        ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
            backgroundColor: token("--state-selected", "var(--active-item-background-color)"),
            color: text
        }
    };
}

/** The syntax colours, mapped from Lezer highlight tags onto the `--code-*` roles. */
export function lumenHighlightStyle(variant: LumenVariant) {
    const syntax = (role: SyntaxRole) => token(`--code-${role}`, SYNTAX_FALLBACKS[variant][role]);

    return HighlightStyle.define([
        { tag: [ tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword, tags.definitionKeyword ], color: syntax("keyword") },
        { tag: [ tags.string, tags.special(tags.string), tags.regexp, tags.character ], color: syntax("string") },
        { tag: [ tags.number, tags.bool, tags.null, tags.atom, tags.unit ], color: syntax("number") },
        { tag: [ tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName ], color: syntax("function") },
        { tag: [ tags.typeName, tags.className, tags.namespace, tags.tagName ], color: syntax("type") },
        { tag: [ tags.propertyName, tags.attributeName, tags.labelName ], color: syntax("property") },
        { tag: [ tags.comment, tags.lineComment, tags.blockComment, tags.docComment ], color: syntax("comment"), fontStyle: "italic" },
        { tag: [ tags.operator, tags.punctuation, tags.bracket, tags.separator ], color: syntax("punctuation") },
        { tag: tags.heading, color: syntax("heading"), fontWeight: "600" },
        { tag: [ tags.link, tags.url ], color: syntax("link"), textDecoration: "underline" },
        { tag: tags.emphasis, fontStyle: "italic" },
        { tag: tags.strong, fontWeight: "600" },
        { tag: tags.strikethrough, textDecoration: "line-through" },
        { tag: tags.invalid, color: token("--state-danger", SYNTAX_FALLBACKS[variant].property) }
    ]);
}

/** The `--code-*` values of Lumen's `semantic.css`; `scripts/retheme/lumen-contrast.spec.ts` keeps them equal. */
export const SYNTAX_FALLBACKS: Record<LumenVariant, Record<SyntaxRole, string>> = {
    light: {
        keyword: "#6a47d4",
        string: "#19673c",
        number: "#ac4c09",
        function: "#3d5bd4",
        type: "#16625f",
        property: "#a72525",
        comment: "#5b606d",
        punctuation: "#444853",
        heading: "#3349b0",
        link: "#3d5bd4"
    },
    dark: {
        keyword: "#b9a3f7",
        string: "#80d6a2",
        number: "#fcc94d",
        function: "#9db6f8",
        type: "#7fd3d0",
        property: "#f6a3a3",
        comment: "#a6abb5",
        punctuation: "#c5c9d1",
        heading: "#c3d3fd",
        link: "#9db6f8"
    }
};

const SEARCH_MATCH_FALLBACKS: Record<LumenVariant, string> = {
    light: "rgb(249 176 36 / 0.18)",
    dark: "rgb(252 201 77 / 0.14)"
};

function token(name: string, fallback: string) {
    return `var(${name}, ${fallback})`;
}
