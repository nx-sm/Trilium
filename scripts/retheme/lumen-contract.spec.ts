import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { scanStylesheet, THEME_FILES, type VariableDefinition } from "./css-variable-inventory.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const TOKENS = "apps/client/src/stylesheets/theme-lumen/tokens";

describe("Lumen theme contract", () => {
    const contract = new Set(Object.values(THEME_FILES)
        .flatMap((file) => definitionsIn(file))
        .filter((definition) => definition.global)
        .map((definition) => definition.name));
    const aliases = definitionsIn(`${TOKENS}/aliases.css`);
    const aliasNames = new Set(aliases.map((alias) => alias.name));
    const primitives = new Set(definitionsIn(`${TOKENS}/primitives.css`).map((definition) => definition.name));
    const semantic = definitionsIn(`${TOKENS}/semantic.css`);
    const semanticNames = new Set(semantic.map((definition) => definition.name));
    const kept: string[] = JSON.parse(readFileSync(join(ROOT, "scripts/retheme/lumen-contract.json"), "utf-8")).kept;

    it("aliases or explicitly keeps every variable the built-in themes declare, and keeps nothing stale", () => {
        expect(contract.size).toBeGreaterThan(300);
        expect([ ...contract ].filter((name) => !aliasNames.has(name) && !kept.includes(name))).toEqual([]);
        expect(kept.filter((name) => !contract.has(name) || aliasNames.has(name))).toEqual([]);
        expect([ ...aliasNames ].filter((name) => !contract.has(name))).toEqual([]);
    });

    it("declares aliases once, at html:root, pointing only at semantic tokens", () => {
        expect(aliases.length).toBe(aliasNames.size);
        for (const alias of aliases) {
            expect(alias.selector, alias.name).toBe("html:root");
            for (const reference of referencesIn(alias.value)) {
                expect(semanticNames.has(reference), `${alias.name} → ${reference}`).toBe(true);
            }
        }
    });

    it("builds semantic tokens from primitives and other semantic tokens, with identical dark tiers", () => {
        for (const definition of semantic) {
            for (const reference of referencesIn(definition.value)) {
                expect(primitives.has(reference) || semanticNames.has(reference), `${definition.name} → ${reference}`).toBe(true);
            }
        }

        const namesIn = (selector: string) => semantic.filter((d) => d.selector === selector).map((d) => d.name).sort();
        const osDark = namesIn(":root:not([data-theme=\"light\"])");
        expect(osDark.length).toBeGreaterThan(20);
        expect(namesIn(":root[data-theme=\"dark\"]")).toEqual(osDark);
        const light = new Set(namesIn(":root"));
        expect(osDark.filter((name) => !light.has(name))).toEqual([]);
    });
});

/**
 * Vellum layers over Lumen: it redeclares semantic tokens and nothing else, so Lumen's aliases carry
 * its values to the theme contract without Vellum naming a contract variable itself.
 */
describe("Vellum theme contract", () => {
    const VELLUM_TOKENS = "apps/client/src/stylesheets/theme-vellum/tokens";
    const primitives = new Set(definitionsIn(`${VELLUM_TOKENS}/primitives.css`).map((definition) => definition.name));
    const semantic = definitionsIn(`${VELLUM_TOKENS}/semantic.css`);
    const semanticNames = new Set(semantic.map((definition) => definition.name));
    const lumenSemantic = new Set(definitionsIn(`${TOKENS}/semantic.css`).map((definition) => definition.name));

    it("redeclares only tokens Lumen declares, and builds them from Vellum's own primitives", () => {
        expect(semanticNames.size).toBeGreaterThan(30);
        expect([ ...semanticNames ].filter((name) => !lumenSemantic.has(name))).toEqual([]);

        for (const definition of semantic) {
            for (const reference of referencesIn(definition.value)) {
                expect(primitives.has(reference) || semanticNames.has(reference), `${definition.name} → ${reference}`).toBe(true);
            }
        }
    });

    it("declares identical dark tiers, each a subset of the light one", () => {
        const namesIn = (selector: string) => semantic.filter((d) => d.selector === selector).map((d) => d.name).sort();
        const osDark = namesIn(":root:not([data-theme=\"light\"])");

        expect(osDark.length).toBeGreaterThan(20);
        expect(namesIn(":root[data-theme=\"dark\"]")).toEqual(osDark);
        const light = new Set(namesIn(":root"));
        expect(osDark.filter((name) => !light.has(name))).toEqual([]);
    });
});

function definitionsIn(file: string): VariableDefinition[] {
    return scanStylesheet(readFileSync(join(ROOT, file), "utf-8"), file).definitions;
}

function referencesIn(value: string) {
    return [ ...value.matchAll(/var\(\s*(--[\w-]+)/g) ].map((match) => match[1] ?? "");
}
