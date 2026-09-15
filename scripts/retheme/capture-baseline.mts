/**
 * Captures the re-theme screenshot matrix (TDD §4 Phase 0, §6.2): each surface in light and dark,
 * on the desktop and mobile layouts, at 360, 768, 1280 and 1920 px wide. Every phase captures the
 * same matrix under its own label, so a later capture compares file-for-file with the baseline.
 *
 * Needs a server on the e2e fixture document, which keeps writes in memory (see
 * `docs/Retheme/Audit.md`, "Screenshot baseline"). Screenshots go to the gitignored `test-output`.
 *
 * Usage: node scripts/retheme/capture-baseline.mts [--label baseline] [--channel msedge]
 *            [--base-url http://127.0.0.1:37999] [--only text-note,options-appearance] [--theme lumen]
 *
 * `--theme` sets the `theme` option for the run and restores the previous value afterwards.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { type Browser, chromium, type Page } from "playwright";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), "..", "..");

/** Time for fonts, lazy chunks and editors to settle after a surface is summoned. */
const SETTLE_MS = 1200;

export type Layout = "desktop" | "mobile";
export type ColorScheme = "light" | "dark";

export interface Surface {
    id: string;
    layouts: Layout[];
    /** Note ID or path that the active tab opens before the capture. */
    notePath?: string;
    /** Command, with its data, triggered once the note has rendered. */
    command?: { name: string; data?: Record<string, unknown> };
    /** Right-clicks the active tree node, which opens its context menu. */
    treeContextMenu?: boolean;
}

export interface CaptureRun {
    layout: Layout;
    viewport: { width: number; height: number };
    colorScheme: ColorScheme;
    directory: string;
    surfaces: Surface[];
}

interface Manifest {
    label: string;
    baseUrl: string;
    theme?: string;
    captured: string[];
    warnings: string[];
    failed: { file: string; error: string }[];
}

const BOTH: Layout[] = [ "desktop", "mobile" ];
const DESKTOP: Layout[] = [ "desktop" ];

/** Surfaces on the e2e fixture document (`packages/trilium-core/src/test/fixtures/document.db`). */
export const SURFACES: Surface[] = [
    { id: "text-note", layouts: BOTH, notePath: "v8ZW4gPAK7Yp" },
    { id: "code-note", layouts: DESKTOP, notePath: "laKbCH4w8B9h" },
    { id: "mermaid-note", layouts: DESKTOP, notePath: "OTSWYwwvpp21" },
    { id: "mind-map-note", layouts: DESKTOP, notePath: "qlLRRwU3qlkR" },
    { id: "relation-map-note", layouts: DESKTOP, notePath: "2VammGGdG6Ie" },
    { id: "pdf-file-note", layouts: DESKTOP, notePath: "oUfFD9lugwiQ" },
    { id: "collection-table", layouts: BOTH, notePath: "_template_table" },
    { id: "collection-board", layouts: DESKTOP, notePath: "_template_board" },
    { id: "collection-calendar", layouts: BOTH, notePath: "_template_calendar" },
    { id: "collection-geo-map", layouts: DESKTOP, notePath: "_template_geo_map" },
    { id: "collection-list", layouts: DESKTOP, notePath: "_template_list_view" },
    { id: "collection-grid", layouts: DESKTOP, notePath: "_template_grid_view" },
    { id: "tree-context-menu", layouts: DESKTOP, notePath: "v8ZW4gPAK7Yp", treeContextMenu: true },
    { id: "dialog-jump-to-note", layouts: BOTH, notePath: "v8ZW4gPAK7Yp", command: { name: "jumpToNote" } },
    { id: "dialog-recent-changes", layouts: DESKTOP, notePath: "v8ZW4gPAK7Yp", command: { name: "showRecentChanges" } },
    { id: "dialog-about", layouts: DESKTOP, notePath: "v8ZW4gPAK7Yp", command: { name: "openAboutDialog" } },
    { id: "options-appearance", layouts: BOTH, command: { name: "showOptions", data: { section: "_optionsAppearance" } } },
    { id: "options-shortcuts", layouts: DESKTOP, command: { name: "showOptions", data: { section: "_optionsShortcuts" } } },
    { id: "options-text-notes", layouts: DESKTOP, command: { name: "showOptions", data: { section: "_optionsTextNotes" } } }
];

export const VIEWPORTS: Record<Layout, { width: number; height: number }[]> = {
    desktop: [ { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 } ],
    mobile: [ { width: 360, height: 780 }, { width: 768, height: 1024 } ]
};

export const COLOR_SCHEMES: ColorScheme[] = [ "light", "dark" ];

export async function main() {
    const { values } = parseArgs({
        options: {
            "label": { type: "string", default: "baseline" },
            "base-url": { type: "string", default: "http://127.0.0.1:37999" },
            "channel": { type: "string" },
            "only": { type: "string" },
            "out": { type: "string", default: "test-output/retheme" },
            "theme": { type: "string" }
        }
    });
    const label = values.label ?? "baseline";
    const baseUrl = values["base-url"] ?? "http://127.0.0.1:37999";
    const outputRoot = resolve(ROOT, values.out ?? "test-output/retheme", label);
    const runs = buildCaptureMatrix(SURFACES, values.only?.split(","));
    const manifest: Manifest = { label, baseUrl, theme: values.theme, captured: [], warnings: [], failed: [] };

    const browser = await chromium.launch({ channel: values.channel });
    try {
        const previousTheme = values.theme ? await setThemeOption(browser, baseUrl, values.theme) : undefined;
        try {
            for (const run of runs) {
                console.log(`${run.directory}: ${run.surfaces.length} surfaces`);
                await captureRun(browser, run, baseUrl, outputRoot, manifest);
            }
        } finally {
            if (previousTheme) {
                await setThemeOption(browser, baseUrl, previousTheme);
            }
        }
    } finally {
        await browser.close();
    }

    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 4)}\n`);
    console.log(`Captured ${manifest.captured.length} screenshots into ${relative(ROOT, outputRoot)}; ` +
        `${manifest.warnings.length} warnings, ${manifest.failed.length} failed.`);
    if (manifest.failed.length > 0) {
        process.exitCode = 1;
    }
}

/** Expands the surfaces into one run per layout, viewport and colour scheme. */
export function buildCaptureMatrix(surfaces: Surface[], only?: string[]): CaptureRun[] {
    const runs: CaptureRun[] = [];
    for (const layout of BOTH) {
        const selected = surfaces.filter((surface) => surface.layouts.includes(layout) && (!only || only.includes(surface.id)));
        if (selected.length === 0) {
            continue;
        }
        for (const viewport of VIEWPORTS[layout]) {
            for (const colorScheme of COLOR_SCHEMES) {
                runs.push({ layout, viewport, colorScheme, directory: `${layout}-${viewport.width}-${colorScheme}`, surfaces: selected });
            }
        }
    }
    return runs;
}

async function captureRun(browser: Browser, run: CaptureRun, baseUrl: string, outputRoot: string, manifest: Manifest) {
    const context = await browser.newContext({
        viewport: run.viewport,
        colorScheme: run.colorScheme,
        reducedMotion: "reduce",
        deviceScaleFactor: 1
    });
    await context.addCookies([ { url: baseUrl, name: "trilium-device", value: run.layout } ]);
    const page = await context.newPage();
    const directory = join(outputRoot, run.directory);
    mkdirSync(directory, { recursive: true });

    try {
        try {
            await loadApp(page, baseUrl);
        } catch (error) {
            for (const surface of run.surfaces) {
                manifest.failed.push({ file: relative(outputRoot, join(directory, `${surface.id}.png`)), error: firstLine(error) });
            }
            return;
        }

        for (const surface of run.surfaces) {
            const file = join(directory, `${surface.id}.png`);
            const name = relative(outputRoot, file);
            try {
                if (!await showSurface(page, surface)) {
                    manifest.warnings.push(`${name}: the surface did not report as rendered`);
                }
                await page.screenshot({ path: file, animations: "disabled", caret: "hide" });
                manifest.captured.push(name);
            } catch (error) {
                manifest.failed.push({ file: name, error: firstLine(error) });
            } finally {
                await dismissOverlays(page, baseUrl, manifest);
            }
        }
    } finally {
        await context.close();
    }
}

/** Summons a surface and resolves to whether its rendered state was observed. */
async function showSurface(page: Page, surface: Surface) {
    let rendered = true;

    if (surface.notePath) {
        await page.evaluate(async (notePath) => {
            await (globalThis as unknown as GlobWindow).glob?.appContext.tabManager.getActiveContext()?.setNote(notePath);
        }, surface.notePath);
        // Collections render through `.note-list-widget` rather than a printable note detail.
        rendered = await page.locator(".note-detail-printable.visible, .note-list-widget").first()
            .waitFor({ state: "visible", timeout: 15_000 })
            .then(() => true, () => false);
        await page.waitForLoadState("networkidle");
    }

    if (surface.treeContextMenu) {
        await page.locator(".tree-wrapper .fancytree-node.fancytree-active").first().click({ button: "right" });
        rendered = await page.locator("#context-menu-container").waitFor({ state: "visible", timeout: 5_000 })
            .then(() => rendered, () => false);
    }

    if (surface.command) {
        await page.evaluate(async ({ name, data }) => {
            await (globalThis as unknown as GlobWindow).glob?.appContext.triggerCommand(name, data);
        }, surface.command);
        rendered = await page.locator(".modal.show").last().waitFor({ state: "visible", timeout: 15_000 })
            .then(() => rendered, () => false);
    }

    await page.waitForTimeout(SETTLE_MS);
    return rendered;
}

/** Saves the `theme` option through the page, as the e2e `setOption` helper does, and resolves to the previous value. */
async function setThemeOption(browser: Browser, baseUrl: string, theme: string) {
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await loadApp(page, baseUrl);
        return await page.evaluate(async (value) => {
            const glob = (globalThis as unknown as GlobWindow).glob;
            const previous = glob?.theme ?? "next";
            const response = await fetch(`api/options/theme/${encodeURIComponent(value)}`, {
                method: "PUT",
                headers: { "x-csrf-token": glob?.csrfToken ?? "" }
            });
            if (!response.ok) {
                throw new Error(`Saving the theme option failed with ${response.status}`);
            }
            return previous;
        }, theme);
    } finally {
        await context.close();
    }
}

async function loadApp(page: Page, baseUrl: string) {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForFunction(() => {
        return Boolean((globalThis as unknown as GlobWindow).glob?.appContext.tabManager.getActiveContext());
    }, undefined, { timeout: 90_000 });
}

/**
 * Closes dialogs with Escape. The tree context menu ignores Escape, so an overlay that is still
 * open afterwards is cleared by loading the app again.
 */
async function dismissOverlays(page: Page, baseUrl: string, manifest: Manifest) {
    const overlays = page.locator(".modal.show, #context-menu-container:visible");
    for (let attempt = 0; attempt < 2; attempt++) {
        if (await overlays.count() === 0) {
            return;
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
    }

    if (await overlays.count() > 0) {
        try {
            await loadApp(page, baseUrl);
        } catch (error) {
            manifest.warnings.push(`reload after a stuck overlay failed: ${firstLine(error)}`);
        }
    }
}

function firstLine(error: unknown) {
    return error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error);
}

/**
 * The part of the page's `window.glob` the capture drives. `page.evaluate` serialises its callback
 * into the page, so each callback reads `glob` itself instead of calling a helper from this module.
 */
interface GlobWindow {
    glob?: {
        theme?: string;
        csrfToken?: string;
        appContext: {
            triggerCommand(name: string, data?: Record<string, unknown>): Promise<unknown>;
            tabManager: { getActiveContext(): { setNote(notePath: string): Promise<unknown> } | null };
        };
    };
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
    await main();
}
