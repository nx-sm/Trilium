import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { embedUrls, inlineImports } from "./bundle-lumen.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");

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

    it("bundles the real theme into a stylesheet with no import left and its icon font embedded", () => {
        const css = inlineImports(join(ROOT, "apps/client/src/stylesheets/theme-lumen.css"), {
            readFile: (path) => readFileSync(path, "utf-8"),
            readBinary: (path) => readFileSync(path)
        });

        expect(css).not.toContain("@import");
        expect(css).toContain("--p-neutral-0:");
        expect(css).toContain("--main-background-color: var(--surface-base);");
        expect(css).toContain(".note-detail-relation-map .note-box");
        expect(css).toMatch(/src: url\(data:font\/woff;base64,[A-Za-z0-9+/]+=*\) format\("woff"\);/);
        expect(css).not.toMatch(/url\((?!data:)/);
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
