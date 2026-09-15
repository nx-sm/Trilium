import { expect, type Locator, test } from "@playwright/test";

import App from "./support/app";

/**
 * The interaction checklist of the re-theme TDD (§6.3) with the Lumen theme active. Theme CSS can
 * break behaviour rather than looks — a menu clipped by an overflow, a row that stops accepting a
 * drop, a toolbar that overflows its bar — so each test drives an interaction and asserts what the
 * app does, not how it looks.
 *
 * Two checklist items are not here: protected note entry, because the password of the e2e fixture is
 * unknown (`packages/trilium-core/src/test/fixtures/generate-protected-fixture.mts`), and Excalidraw
 * pointer input, because the fixture holds no canvas note.
 */

const SAMPLES = "Samples";
const FIRST_CHILD = "Code notes";
const SECOND_CHILD = "Text notes";
const TEXT_NOTE = "v8ZW4gPAK7Yp";
const MIND_MAP_NOTE = "qlLRRwU3qlkR";
const TABLE_COLLECTION = "_template_table";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page, context }) => {
    const app = new App(page, context);
    await app.goto();
    await app.setOption("theme", "lumen");
    await app.goto();
    await expect(page.locator("link[href*='theme-lumen.css']")).toBeAttached();
});

test.afterEach(async ({ page, context }) => {
    const app = new App(page, context);
    await app.setOption("theme", "next");
});

test("Tree rows expand, multi-select and reorder", async ({ page, context }) => {
    const app = new App(page, context);
    const samples = treeNode(app, SAMPLES);
    const expander = samples.locator(".fancytree-expander");

    // Expand and collapse.
    if (!(await samples.getAttribute("class"))?.includes("fancytree-expanded")) {
        await expander.click();
    }
    await expect(samples).toHaveClass(/fancytree-expanded/);
    await expect(treeNode(app, FIRST_CHILD)).toBeVisible();
    await expander.click();
    await expect(treeNode(app, FIRST_CHILD)).toBeHidden();
    await expander.click();
    await expect(treeNode(app, FIRST_CHILD)).toBeVisible();

    // Multi-select, which the tree puts on Alt+click (Ctrl+click opens a tab).
    const selected = app.noteTree.locator("span.fancytree-node.fancytree-selected");
    await treeNode(app, FIRST_CHILD).locator(".fancytree-title").click({ modifiers: [ "Alt" ] });
    await treeNode(app, SECOND_CHILD).locator(".fancytree-title").click({ modifiers: [ "Alt" ] });
    await expect(selected).toHaveCount(2);
    await treeNode(app, FIRST_CHILD).locator(".fancytree-title").click({ modifiers: [ "Alt" ] });
    await treeNode(app, SECOND_CHILD).locator(".fancytree-title").click({ modifiers: [ "Alt" ] });
    await expect(selected).toHaveCount(0);

    // Drag the first child past the second and back, dropping on the lower half of the target row.
    expect(await rowIndex(app, FIRST_CHILD)).toBeLessThan(await rowIndex(app, SECOND_CHILD));
    await dropAfter(app, FIRST_CHILD, SECOND_CHILD);
    await expect(async () => {
        expect(await rowIndex(app, FIRST_CHILD)).toBeGreaterThan(await rowIndex(app, SECOND_CHILD));
    }).toPass();

    await dropAfter(app, SECOND_CHILD, FIRST_CHILD);
    await expect(async () => {
        expect(await rowIndex(app, FIRST_CHILD)).toBeLessThan(await rowIndex(app, SECOND_CHILD));
    }).toPass();
});

test("Tabs open and close", async ({ page, context }) => {
    const app = new App(page, context);
    await app.closeAllTabs();
    await app.clickNoteOnNoteTreeByTitle(SAMPLES);

    const tabs = app.tabBar.locator(".note-tab-wrapper");
    await app.addNewTab();
    await expect(tabs).toHaveCount(2);

    const secondTab = await app.getTab(1);
    await secondTab.hover();
    await secondTab.locator(".note-tab-close").click();
    await expect(tabs).toHaveCount(1);
});

test("The tree context menu opens inside the viewport at the bottom edge", async ({ page, context }) => {
    // Tall enough to hold the whole menu: the tree's menu runs to some 600 px, and a menu taller than
    // the viewport cannot be placed inside it whatever the theme does.
    const height = 900;
    await page.setViewportSize({ width: 1024, height });
    const app = new App(page, context);

    // The tree keeps the rows of collapsed parents in the DOM, so the last row of all is not
    // necessarily on screen; the last one that is sits at the bottom of the pane.
    const lastRow = app.noteTree.locator("span.fancytree-node").filter({ visible: true }).last();
    await lastRow.click({ button: "right" });

    // The container is the menu itself, and `show()` moves it into whatever holds the screen, so it
    // is found by its id rather than through a parent.
    const menu = page.locator("#context-menu-container");
    await expect(menu).toHaveClass(/show/);
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height + 1);

    // The menu closes on a click outside it, which a clipped menu would swallow.
    await app.currentNoteSplit.click({ position: { x: 5, y: 5 } });
    await expect(menu).toBeHidden();
});

test("The classic text editor toolbar stays inside its bar at a narrow width", async ({ page, context }) => {
    const width = 800;
    await page.setViewportSize({ width, height: 720 });
    const app = new App(page, context);

    // The fixture edits with the floating toolbar, which has nothing to overflow; the checklist item
    // is the classic one, which the desktop layout draws in a bar of its own below the note.
    await app.setOption("textNoteEditorType", "ckeditor-classic");
    try {
        await app.goto();
        await openNote(app, TEXT_NOTE);

        const bar = page.locator(".classic-toolbar-widget").first();
        const toolbar = bar.locator(".ck.ck-toolbar").first();
        await expect(toolbar).toBeVisible();
        const toolbarBox = await toolbar.boundingBox();
        const barBox = await bar.boundingBox();
        expect(toolbarBox).not.toBeNull();
        expect(barBox).not.toBeNull();
        expect(toolbarBox?.width ?? 0).toBeLessThanOrEqual((barBox?.width ?? 0) + 1);

        // What does not fit goes into a group, whose panel opens inside the viewport.
        const grouped = toolbar.locator(".ck-toolbar__grouped-dropdown");
        if (await grouped.count() > 0) {
            await grouped.first().locator("button").first().click();
            const panel = page.locator(".ck-dropdown__panel-visible").first();
            await expect(panel).toBeVisible();
            const panelBox = await panel.boundingBox();
            expect(panelBox?.x ?? -1).toBeGreaterThanOrEqual(0);
            expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(width + 1);
        }
    } finally {
        await app.setOption("textNoteEditorType", "ckeditor-balloon");
    }
});

test("Collection views switch between table, calendar and board", async ({ page, context }) => {
    const app = new App(page, context);
    await openNote(app, TABLE_COLLECTION);

    const properties = app.currentNoteSplit.locator(".collection-properties");
    await expect(properties).toBeVisible();
    await expect(app.currentNoteSplit.locator(".table-view")).toBeVisible();
    await switchView(app, properties, "Calendar");
    await expect(app.currentNoteSplit.locator(".calendar-view")).toBeVisible();
    await switchView(app, properties, "Board");
    await expect(app.currentNoteSplit.locator(".board-view")).toBeVisible();

    // The fixture's collection notes are shared with every other test here.
    await switchView(app, properties, "Table");
    await expect(app.currentNoteSplit.locator(".table-view")).toBeVisible();
});

test("Mind map nodes answer pointer input", async ({ page, context }) => {
    const app = new App(page, context);
    await openNote(app, MIND_MAP_NOTE);

    await app.currentNoteSplit.locator("me-tpc").filter({ hasText: "Hello world" }).click({ force: true });
    await expect(app.currentNoteSplit.locator(".mind-map-node-panel")).toBeVisible();
});

/**
 * Opens a note in the active tab by its ID, which the app resolves to a note path of its own. A
 * hash of `#root/<noteId>` would not: none of these notes is a child of the root.
 */
async function openNote(app: App, noteId: string) {
    await app.page.evaluate(async (id: string) => {
        await (window as any).glob.appContext.tabManager.getActiveContext()?.setNote(id);
    }, noteId);
}

/**
 * Picks a view from a collection's view switcher. The shared dropdown helper matches an item by
 * substring, which "Board" and "Dashboard" both answer to.
 */
async function switchView(app: App, properties: Locator, view: string) {
    await properties.locator(".dropdown-toggle").first().click();
    await app.page.locator(".dropdown-menu.show .dropdown-item")
        .filter({ has: app.page.getByText(view, { exact: true }) })
        .first()
        .click();
}

/** The tree row whose title is exactly `title`. */
function treeNode(app: App, title: string) {
    return app.noteTree.locator("span.fancytree-node")
        .filter({ has: app.page.getByText(title, { exact: true }) })
        .first();
}

/** The position of a row among the rows the tree currently draws. */
async function rowIndex(app: App, title: string) {
    const titles = await app.noteTree.locator("span.fancytree-node span.fancytree-title").allInnerTexts();
    return titles.findIndex((text) => text.trim() === title);
}

/** Drags one row onto the lower half of another, which is where dnd5 drops it after that row. */
async function dropAfter(app: App, title: string, targetTitle: string) {
    const target = treeNode(app, targetTitle).locator(".fancytree-title");
    const targetBox = await target.boundingBox();
    expect(targetBox).not.toBeNull();
    await treeNode(app, title).locator(".fancytree-title").dragTo(target, {
        targetPosition: { x: 10, y: Math.max(1, (targetBox?.height ?? 20) - 2) }
    });
}
