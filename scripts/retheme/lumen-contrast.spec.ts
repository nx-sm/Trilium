import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { scanStylesheet } from "./css-variable-inventory.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const TOKENS = "apps/client/src/stylesheets/theme-lumen/tokens";

type Rgba = [ number, number, number, number ];

/**
 * WCAG 2.1 AA for Lumen's semantic tokens (TDD §6.6): 4.5:1 for text, 3:1 for focus indicators and
 * control borders. Translucent tokens are composited over the surface they are drawn on.
 */
describe("Lumen contrast", () => {
    const primitives = tokensWhere("primitives.css", () => true);
    const light = { ...primitives, ...tokensWhere("semantic.css", (selector) => selector === ":root") };
    const dark = { ...light, ...tokensWhere("semantic.css", (selector) => selector === ":root[data-theme=\"dark\"]") };

    const TEXT_PAIRS: [ string, string ][] = [
        [ "--text-primary", "--surface-base" ],
        [ "--text-primary", "--surface-sunken" ],
        [ "--text-primary", "--surface-overlay" ],
        [ "--text-secondary", "--surface-base" ],
        [ "--text-secondary", "--surface-sunken" ],
        [ "--text-secondary", "--surface-overlay" ],
        [ "--text-tertiary", "--surface-base" ],
        [ "--text-tertiary", "--surface-sunken" ],
        [ "--text-tertiary", "--surface-overlay" ],
        [ "--text-tertiary", "--surface-raised" ],
        [ "--accent-text", "--surface-base" ],
        [ "--accent-text", "--surface-overlay" ],
        [ "--state-danger", "--surface-base" ],
        [ "--state-warning", "--surface-base" ],
        [ "--state-success", "--surface-base" ],
        [ "--text-on-accent", "--accent-default" ],
        [ "--text-on-accent", "--state-danger" ],
        [ "--text-on-accent", "--state-success" ],
        [ "--text-inverse", "--surface-inverse" ],
        [ "--text-on-emphasis", "--surface-emphasis" ]
    ];

    /** Text drawn on a translucent fill, which sits on a surface: [text, fill, surface]. */
    const LAYERED_TEXT: [ string, string, string ][] = [
        [ "--text-primary", "--state-selected", "--surface-sunken" ],
        [ "--text-primary", "--state-pressed", "--surface-sunken" ],
        [ "--text-tertiary", "--state-hover", "--surface-base" ],
        [ "--text-tertiary", "--state-hover", "--surface-overlay" ]
    ];

    const NON_TEXT_PAIRS: [ string, string ][] = [
        [ "--focus-ring-color", "--surface-base" ],
        [ "--focus-ring-color", "--surface-sunken" ],
        [ "--focus-ring-color", "--surface-overlay" ],
        [ "--border-strong", "--surface-base" ]
    ];

    for (const [ scheme, tokens ] of [ [ "light", light ], [ "dark", dark ] ] as const) {
        it(`meets AA for text and indicators in the ${scheme} scheme`, () => {
            const color = (name: string) => resolveColor(name, tokens);
            const failures: string[] = [];
            const check = (label: string, ratio: number, minimum: number) => {
                if (ratio < minimum) {
                    failures.push(`${label}: ${ratio.toFixed(2)} < ${minimum}`);
                }
            };

            for (const [ text, surface ] of TEXT_PAIRS) {
                const background = color(surface);
                check(`${text} on ${surface}`, contrast(over(color(text), background), background), 4.5);
            }
            for (const [ text, fill, surface ] of LAYERED_TEXT) {
                const background = over(color(fill), color(surface));
                check(`${text} on ${fill} over ${surface}`, contrast(over(color(text), background), background), 4.5);
            }
            for (const [ indicator, surface ] of NON_TEXT_PAIRS) {
                const background = color(surface);
                check(`${indicator} on ${surface}`, contrast(over(color(indicator), background), background), 3);
            }

            expect(failures).toEqual([]);
        });
    }
});

function tokensWhere(file: string, matches: (selector: string) => boolean) {
    const { definitions } = scanStylesheet(readFileSync(join(ROOT, TOKENS, file), "utf-8"), file);
    return Object.fromEntries(definitions.filter((d) => matches(d.selector)).map((d) => [ d.name, d.value ]));
}

/** Resolves `var()`, hex colours and `color-mix(in srgb, <colour> N%, transparent)` to RGBA. */
function resolveColor(name: string, tokens: Record<string, string>, depth = 0): Rgba {
    const value = tokens[name];
    if (value === undefined || depth > 10) {
        throw new Error(`Cannot resolve ${name}`);
    }
    return parseColor(value, tokens, depth);
}

function parseColor(value: string, tokens: Record<string, string>, depth: number): Rgba {
    const trimmed = value.trim();
    const reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(trimmed);
    if (reference) {
        return resolveColor(reference[1] ?? "", tokens, depth + 1);
    }

    const hex = /^#([0-9a-f]{6})$/i.exec(trimmed);
    if (hex) {
        const digits = hex[1] ?? "000000";
        return [ 0, 2, 4 ].map((offset) => parseInt(digits.slice(offset, offset + 2), 16)).concat(1) as Rgba;
    }

    const mix = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*transparent\)$/.exec(trimmed);
    if (mix) {
        const [ r, g, b, a ] = parseColor(mix[1] ?? "", tokens, depth + 1);
        return [ r, g, b, a * Number(mix[2]) / 100 ];
    }

    throw new Error(`Unsupported colour value: ${value}`);
}

function over(top: Rgba, bottom: Rgba): Rgba {
    const alpha = top[3];
    return [ 0, 1, 2 ].map((i) => (top[i] ?? 0) * alpha + (bottom[i] ?? 0) * (1 - alpha)).concat(1) as Rgba;
}

function contrast(a: Rgba, b: Rgba) {
    const [ lighter, darker ] = [ luminance(a), luminance(b) ].sort((x, y) => y - x);
    return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

function luminance([ r, g, b ]: Rgba) {
    const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
