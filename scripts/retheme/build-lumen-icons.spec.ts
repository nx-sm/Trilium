import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as opentypeModule from "opentype.js";
import { describe, expect, it } from "vitest";

import {
    BOXICONS_MANIFEST, type BoxiconsManifest, collectBoxiconsFontRules, CSS_OUTPUT, FONT_FAMILY, FONT_OUTPUT,
    INVENTORY, type InventoryEntry, liftSelector, listStylesheets, parseTablerGlyphs, renderFontRules,
    resolveRemaps, ROOT, sfntToWoff, subsetFont, unicodeRange
} from "./build-lumen-icons.mjs";

const opentype = opentypeModule.default ?? opentypeModule;

describe("parseTablerGlyphs", () => {
    it("reads the codepoint of every icon class and nothing else", () => {
        const glyphs = parseTablerGlyphs(`.ti { font-family: "tabler-icons" !important; }
.ti-plus:before {
  content: "\\eb0b";
}
.ti-arrows-vertical::before { content: "\\eb73"; }`);

        expect([ ...glyphs ]).toEqual([ [ "plus", 0xeb0b ], [ "arrows-vertical", 0xeb73 ] ]);
    });
});

describe("resolveRemaps", () => {
    const boxicons: BoxiconsManifest = {
        metrics: { ascent: 0.9375, descent: 0.0625 },
        icons: {
            "bx-search": { glyph: "" },
            "bx-search-alt": { glyph: "\\ebf6" },
            "bx-plus": { glyph: "" },
            "bxl-java": { glyph: "" }
        }
    };
    const entry = (name: string, tabler: string | null, grade: string): InventoryEntry => ({ boxicons: name, uses: 1, tabler, grade, verified: true });

    it("groups the Boxicons names that share a Tabler glyph, and skips what stays Boxicons", () => {
        const remaps = resolveRemaps([
            entry("bx-search", "search", "exact"),
            entry("bx-search-alt", "search", "close"),
            entry("bx-plus", "plus", "weak"),
            entry("bxl-java", "file-code", "none"),
            entry("bx-spin", null, "utility"),
            entry("bx-alert", "alert-triangle", "weak")
        ], boxicons, new Map([ [ "search", 0xeb1c ], [ "plus", 0xeb0b ], [ "file-code", 0xeaec ], [ "alert-triangle", 0xea06 ] ]));

        expect(remaps).toEqual([
            { tabler: "plus", tablerCodepoint: 0xeb0b, unicodes: [ 0xebc0 ] },
            { tabler: "search", tablerCodepoint: 0xeb1c, unicodes: [ 0xebf6, 0xebf7 ] }
        ]);
    });

    it("fails on a Tabler name that the webfont does not have", () => {
        expect(() => resolveRemaps([ entry("bx-plus", "plus-gone", "exact") ], boxicons, new Map())).toThrow("bx-plus → plus-gone");
    });
});

describe("collectBoxiconsFontRules", () => {
    it("flattens nesting and selector lists, keeps at-rules and !important, and ignores other fonts", () => {
        const css = `
/* a comment with { braces } and font-family: boxicons; */
.a::before, .b:is(.c, .d)::after { content: "\\ea50"; font-family: boxicons !important; }
.e { font-family: Inter, sans-serif; }
@font-face { font-family: boxicons; src: url(x.woff2); }
@media (max-width: 10px) {
    .f {
        --task-state-glyph-font-family: "boxicons";
        > .g { &::before { font-family: boxicons, serif; } }
    }
}
.h { content: "{"; font-family: 'boxicons' }`;

        expect(collectBoxiconsFontRules(css)).toEqual([
            { atRules: [], selectors: [ ".a::before", ".b:is(.c, .d)::after" ], property: "font-family", value: `"${FONT_FAMILY}", boxicons`, important: true },
            { atRules: [ "@media (max-width: 10px)" ], selectors: [ ".f" ], property: "--task-state-glyph-font-family", value: `"${FONT_FAMILY}", "boxicons"`, important: false },
            { atRules: [ "@media (max-width: 10px)" ], selectors: [ ".f > .g::before" ], property: "font-family", value: `"${FONT_FAMILY}", boxicons, serif`, important: false },
            { atRules: [], selectors: [ ".h" ], property: "font-family", value: `"${FONT_FAMILY}", 'boxicons'`, important: false }
        ]);
    });

    it("renders each distinct rule once, lifted and wrapped in its at-rules", () => {
        const rules = collectBoxiconsFontRules("@media print { .a, :root .b { font-family: boxicons; } }\n.c { font-family: boxicons !important; }\n.c { font-family: boxicons !important; }");

        expect(renderFontRules(rules)).toEqual([
            `@media print {\n    html:root .a,\n    html:root .b {\n        font-family: "${FONT_FAMILY}", boxicons;\n    }\n}`,
            `html:root .c {\n    font-family: "${FONT_FAMILY}", boxicons !important;\n}`
        ]);
    });
});

describe("liftSelector", () => {
    it("adds html:root once, merging with a selector that already starts at the root", () => {
        expect([ ".a .b", ":root .ck", "html[dir=rtl] .x", "body.mobile .y", "htmlish" ].map(liftSelector))
            .toEqual([ "html:root .a .b", "html:root .ck", "html:root[dir=rtl] .x", "html:root body.mobile .y", "html:root htmlish" ]);
    });
});

describe("unicodeRange", () => {
    it("sorts, removes duplicates and joins consecutive codepoints", () => {
        expect(unicodeRange([ 0xea52, 0xea50, 0xeb00, 0xea51, 0xea50 ])).toEqual([ "U+EA50-EA52", "U+EB00" ]);
    });
});

describe("subsetFont and sfntToWoff", () => {
    it("re-encodes glyphs at new codepoints, centres their ink and writes a WOFF that parses", () => {
        const source = new opentype.Font({
            familyName: "Source",
            styleName: "Regular",
            unitsPerEm: 1000,
            ascender: 900,
            descender: -100,
            glyphs: [
                new opentype.Glyph({ name: ".notdef", advanceWidth: 1000, path: new opentype.Path() }),
                new opentype.Glyph({ name: "a", unicode: 0xe001, advanceWidth: 1000, path: box(0, 800) }),
                new opentype.Glyph({ name: "b", unicode: 0xe002, advanceWidth: 1000, path: box(-100, 700) }),
                new opentype.Glyph({ name: "c", unicode: 0xe003, advanceWidth: 900, path: box(100, 900) })
            ]
        });
        const remaps = [
            { tabler: "a", tablerCodepoint: 0xe001, unicodes: [ 0xea50, 0xea51 ] },
            { tabler: "b", tablerCodepoint: 0xe002, unicodes: [ 0xea60 ] },
            { tabler: "c", tablerCodepoint: 0xe003, unicodes: [ 0xeb00 ] }
        ];

        const sfnt = subsetFont(new Uint8Array(source.toArrayBuffer()), remaps, 0.4375);
        const woff = sfntToWoff(sfnt);
        const font = opentype.parse(woff.buffer);

        expect(new TextDecoder().decode(woff.subarray(0, 4))).toBe("wOFF");
        expect(new DataView(woff.buffer).getUint32(8)).toBe(woff.length);
        expect(Object.keys(font.tables.cmap.glyphIndexMap).map(Number)).toEqual([ 0xea50, 0xea51, 0xea60, 0xeb00 ]);
        expect(font.charToGlyph(String.fromCodePoint(0xe001)).index).toBe(0);

        // Median ink centre 400 moves to 437.5, rounded to a 38-unit shift.
        const a = font.charToGlyph(String.fromCodePoint(0xea51));
        const c = font.charToGlyph(String.fromCodePoint(0xeb00));
        expect([ a.name, a.advanceWidth, a.getBoundingBox().y1, a.getBoundingBox().y2 ]).toEqual([ "a", 1000, 38, 838 ]);
        expect([ c.advanceWidth, c.getBoundingBox().y1 ]).toEqual([ 900, 138 ]);

        expect(font.tables.head.modified).toBe(font.tables.head.created);
        expect(checksum(sfnt)).toBe(0xb1b0afba);
    });
});

describe("Lumen's committed icon font and stylesheet", () => {
    const inventory: InventoryEntry[] = JSON.parse(readFileSync(join(ROOT, INVENTORY), "utf-8"));
    const boxicons: BoxiconsManifest = JSON.parse(readFileSync(join(ROOT, BOXICONS_MANIFEST), "utf-8"));
    const css = readFileSync(join(ROOT, CSS_OUTPUT), "utf-8");
    const bytes = readFileSync(join(ROOT, FONT_OUTPUT));
    const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const tablerNames = new Map(inventory.flatMap((entry) => entry.tabler ? [ [ entry.tabler, 0 ] as const ] : []));
    const remapped = resolveRemaps(inventory, boxicons, tablerNames).flatMap((remap) => remap.unicodes);

    it("draws exactly the Boxicons codepoints that the inventory remaps, and its face covers only those", () => {
        const drawn = Object.keys(font.tables.cmap.glyphIndexMap).map(Number);
        const range = /unicode-range:([^;]+);/.exec(css)?.[1].split(",").map((part) => part.trim());

        expect(remapped.length).toBeGreaterThan(300);
        expect(drawn.toSorted((a, b) => a - b)).toEqual(remapped.toSorted((a, b) => a - b));
        expect(range).toEqual(unicodeRange(remapped));
    });

    it("centres its glyphs where Boxicons draws its own", () => {
        const centres = Object.values(font.tables.cmap.glyphIndexMap as Record<string, number>)
            .map((index) => font.glyphs.get(index).getBoundingBox())
            .map((box) => (box.y1 + box.y2) / 2)
            .toSorted((a, b) => a - b);
        const median = centres[Math.floor(centres.length / 2)];

        expect(Math.abs(median - (boxicons.metrics.ascent - 0.5) * font.unitsPerEm)).toBeLessThanOrEqual(1);
    });

    it("puts Tabler in front of Boxicons in every stylesheet rule that names the Boxicons font", () => {
        const rules = listStylesheets().flatMap((file) => collectBoxiconsFontRules(readFileSync(file, "utf-8")));

        expect(rules.length).toBeGreaterThan(10);
        for (const block of renderFontRules(rules)) {
            expect(css).toContain(block);
        }
    });
});

function box(bottom: number, top: number) {
    const path = new opentype.Path();
    path.moveTo(100, bottom);
    path.lineTo(900, bottom);
    path.quadraticCurveTo(900, top, 100, top);
    path.close();
    return path;
}

function checksum(data: Uint8Array) {
    let sum = 0;
    for (let index = 0; index < data.length; index += 4) {
        sum = (sum + (((data[index] << 24) | ((data[index + 1] ?? 0) << 16) | ((data[index + 2] ?? 0) << 8) | (data[index + 3] ?? 0)) >>> 0)) >>> 0;
    }
    return sum;
}
