import { describe, expect, it } from "vitest";

import { buildCaptureMatrix, COLOR_SCHEMES, SURFACES, VIEWPORTS } from "./capture-baseline.mjs";

describe("buildCaptureMatrix", () => {
    it("runs every layout at each of its widths in both colour schemes, with only that layout's surfaces", () => {
        const runs = buildCaptureMatrix(SURFACES);

        expect(runs).toHaveLength((VIEWPORTS.desktop.length + VIEWPORTS.mobile.length) * COLOR_SCHEMES.length);
        expect(runs.map((run) => run.directory)).toContain("mobile-360-dark");
        expect(new Set(runs.map((run) => run.viewport.width))).toEqual(new Set([ 360, 768, 1280, 1920 ]));

        const mobile = runs.find((run) => run.layout === "mobile");
        expect(mobile?.surfaces.every((surface) => surface.layouts.includes("mobile"))).toBe(true);
        expect(mobile?.surfaces.some((surface) => surface.id === "tree-context-menu")).toBe(false);
    });

    it("restricts runs to the requested surfaces and drops layouts left without any", () => {
        const runs = buildCaptureMatrix(SURFACES, [ "tree-context-menu" ]);

        expect(runs.map((run) => run.directory)).toEqual([
            "desktop-768-light", "desktop-768-dark",
            "desktop-1280-light", "desktop-1280-dark",
            "desktop-1920-light", "desktop-1920-dark"
        ]);
        expect(runs.every((run) => run.surfaces.length === 1)).toBe(true);
    });

    it("names every surface uniquely, so no capture overwrites another", () => {
        const ids = SURFACES.map((surface) => surface.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
