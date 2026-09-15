import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { inlineImports } from "./bundle-lumen.mjs";

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
        expect(inlineImports("/theme/entry.css", read)).toBe(".b {}\n.a {}\n\n.entry {}\n");
    });

    it("fails on an import that does not exist", () => {
        expect(() => inlineImports("/theme/tokens/a.css", (path) => path.endsWith("a.css") ? "@import url(./gone.css);" : read(path)))
            .toThrow("Missing");
    });

    it("bundles the real theme into a stylesheet with no import left", () => {
        const css = inlineImports(join(ROOT, "apps/client/src/stylesheets/theme-lumen.css"), (path) => readFileSync(path, "utf-8"));

        expect(css).not.toContain("@import");
        expect(css).toContain("--p-neutral-0:");
        expect(css).toContain("--main-background-color: var(--surface-base);");
        expect(css).toContain(".note-detail-relation-map .note-box");
    });
});
