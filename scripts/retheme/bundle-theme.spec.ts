import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { bundle, type BundleReader, embedUrls, inlineImports, THEMES } from "./bundle-theme.mjs";

const realReader: BundleReader = {
    readFile: (path) => readFileSync(path, "utf-8"),
    readBinary: (path) => readFileSync(path)
};

describe("inlineImports", () => {
    const files = Object.fromEntries(Object.entries({
        "/theme/entry.css": "@import url(./tokens/a.css);\n@import url(\"./b.css\");\n.entry {}\n",
        "/theme/tokens/a.css": "@import url(../b.css);\n.a {}\n",
        "/theme/b.css": ".b {}\n"
    }).map(([ path, content ]) => [ resolve(path), content ]));

    const read = (path: string) => {
        const content = files[path];
        if (content === undefined) {
            throw new Error(`Missing ${path}`);
        }
        return content;
    };

    it("inlines nested imports in order, relative to the importing file, and each file once", () => {
        expect(inlineImports("/theme/entry.css", { readFile: read })).toBe(".b {}\n.a {}\n\n.entry {}\n");
    });

    it("fails on an import that does not exist", () => {
        expect(() => inlineImports("/theme/tokens/a.css", { readFile: (path) => path.endsWith("a.css") ? "@import url(./gone.css);" : read(path) }))
            .toThrow("Missing");
    });
});

describe("bundle", () => {
    it("bundles Lumen into a stylesheet with no import left and its icon font embedded", () => {
        const css = bundle(THEMES.lumen, realReader);

        expect(css).not.toContain("@import");
        expect(css).toContain("--p-neutral-0:");
        expect(css).toContain("--main-background-color: var(--surface-base);");
        expect(css).toContain(".note-detail-relation-map .note-box");
        expect(css).toMatch(/src: url\(data:font\/woff;base64,[A-Za-z0-9+/]+=*\) format\("woff"\);/);
        expect(css).not.toMatch(/url\((?!data:)/);
    });

    it("bundles Vellum over Lumen, carrying each file once", () => {
        const css = bundle(THEMES.vellum, realReader);

        expect(css).not.toContain("@import");
        // Lumen underneath, once, and Vellum's own layer after it.
        expect(css.match(/--p-neutral-0:/g)).toHaveLength(1);
        expect(css.match(/--v-neutral-0:/g)).toHaveLength(1);
        expect(css.indexOf("--v-neutral-0:")).toBeGreaterThan(css.indexOf("--p-neutral-0:"));
        expect(css).toContain("line-height: var(--line-height-content);");
    });

    it("names each theme's own install label", () => {
        expect(THEMES.lumen.label).toBe("lumen-standalone");
        expect(THEMES.vellum.label).toBe("vellum-standalone");
    });
});

describe("embedUrls", () => {
    it("embeds relative font URLs, resolved against the stylesheet, and leaves the rest alone", () => {
        const readBinary = (path: string) => {
            expect(path).toBe(resolve("/theme/fonts/icons.woff"));
            return new Uint8Array([ 1, 2, 3 ]);
        };
        const unchanged = "@import url(./tokens.css);\n.a { background: url(data:image/png;base64,AA==), url(https://example.com/x.png); }";

        expect(embedUrls(`${unchanged}\n@font-face { src: url("../theme/fonts/icons.woff") format("woff"); }`, "/theme", readBinary))
            .toBe(`${unchanged}\n@font-face { src: url(data:font/woff;base64,AQID) format("woff"); }`);
    });

    it("fails on a file type it has no media type for", () => {
        expect(() => embedUrls(".a { background: url(x.png); }", "/theme", () => new Uint8Array())).toThrow("x.png");
    });
});
