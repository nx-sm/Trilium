# Re-theme audit (Phase 0)

The written audit that the re-theme TDD (Trilium UI Re-theme, §4 Phase 0) makes blocking: every later
phase depends on it. Baseline: `main` at `c775199ba6` (v0.105.0), audited 15/09/2026.

## Deliverables

| # | Deliverable | Where | How to regenerate |
| --- | --- | --- | --- |
| 1 | CSS variable inventory, with usage counts | [`inventory/css-variables.md`](inventory/css-variables.md), [`.json`](inventory/css-variables.json) | `node scripts/retheme/css-variable-inventory.mts` |
| 2 | Surface inventory, by owner and mount point | [`Surface inventory.md`](Surface%20inventory.md) | Manual audit |
| 3 | Icon inventory, mapped to Tabler Icons | [`inventory/icons.md`](inventory/icons.md), [`.json`](inventory/icons.json) | Manual audit |
| 4 | Screenshot baseline | `test-output/retheme/baseline/` (gitignored) | [Screenshot baseline](#screenshot-baseline) below |
| 5 | Selector-coupling report | [`Selector coupling.md`](Selector%20coupling.md) | Manual audit |

## Findings

### Variables

- `apps/client/src` uses **1021** custom properties. **398** form the theme contract: the names that
  `theme-light.css`, `theme-dark.css`, `theme-next-light.css`, `theme-next-dark.css` and
  `theme-next/base.css` declare globally, and that third-party themes override.
- 56 are used but never defined in the client, mostly Bootstrap's `--bs-*`. 173 are defined but never
  used in the client; some are still read by `packages/pdfjs-viewer` or by third-party themes.
- **`PdfViewer.tsx` copies every `:root` custom property into the PDF.js frame as `--tn-*`.** Renaming or
  removing a root token unstyles the PDF viewer, so new tokens are additive and existing names stay.
- JavaScript reads 27 named custom properties back (`--theme-style`, `--allow-background-effects`,
  `--background-material`, `--native-titlebar-*`, `--tab-note-icons`, `--tree-item-*-lightness`,
  `--mermaid-theme`, `--main-background-color` for mind maps, and others). Their values must stay in the
  format JS parses: see [Selector coupling](Selector%20coupling.md), section (b).

### Surfaces

- 165 surfaces: 134 native, 31 vendored.
- **The new layout is the default** (`newLayout` defaults to `true`; mobile always uses it). The ribbon,
  floating buttons and the jQuery right pane exist only in the old layout. The new layout's status bar,
  breadcrumb, inline title and tabbed right panel are styled by their own component CSS and get almost
  nothing from theme-next.
- How much v0.105 already modernises the Phase 2 chrome:

  | Surface | Verdict |
  | --- | --- |
  | Launcher bar | Largely modernised; restyling is token work |
  | Tab bar | Visually modernised; geometry still owned by `tab_row.ts` and its 276-line inline `<style>` |
  | Note tree rows | Substantially modernised; no `--tree-*` token family; FancyTree still decides layout |
  | Ribbon | Barely touched, and old-layout only |
  | Right panel | Old layout restyled; new-layout panel styled by its own CSS |
  | Split view dividers | Colour only |
  | Context menus | Modernised through `.dropdown-menu`; engine still jQuery |
  | Toasts | Fully modernised (Preact) |

- Surfaces the app theme does not colour: CodeMirror and highlight.js (own theme options), reveal.js,
  PDF.js (iframe), Univer, force-graph (reads variables at render time).

### Icons

- 398 Boxicons names in 1750 chrome call sites: 237 map exactly to Tabler, 142 closely, 8 weakly, 3 not at
  all (`bxl-java`, `bxl-less`, `bxl-postgresql`); 8 are Boxicons helper classes.
- Tabler names are unverified except six confirmed by local files, because no Tabler package is in the
  dependency tree. `apps/icon-pack-builder` has no Tabler provider.
- Two icons render nothing today: `bx-alert` (`desktop.ts:38`) and `bx-inbox`
  (`collection-properties-config.tsx:161`) are not Boxicons 2 names.
- A class rename does not reach 40 CSS rules that draw icons by codepoint with `font-family: boxicons`,
  nor the launcher and system note icons that `hidden_subtree*.ts` persists into every database.

### Selector coupling

78 findings: 19 High, 31 Medium, 28 Low. The ones that constrain token and chrome work most:

- Desktop submenus sit at `opacity: 0` until the `dropdown-menu-opening` animation runs
  (`style.css:473-492`). Overriding `animation` on `.dropdown-menu`, including with a reduced-motion rule,
  leaves every submenu invisible.
- `.note-tab` is positioned by JS (`transform`, `width`); `.note-new-tab` and the tab scroll buttons are
  measured once and cached. Restyle `.note-tab-wrapper`, not `.note-tab`, and keep their outer widths.
- FancyTree computes drop zones from the row's content height, and hides filtered nodes with
  `display: none` at `(0,2,1)` specificity. Keep row height and vertical padding; never set `display` on
  `span.fancytree-node` at ID specificity.
- Split.js gutters take a 5px inline size: no margin, border, padding or width on `.gutter` or the pane IDs.
- The vertical launcher's outer width is measured once for the left-pane split.
- Dialog z-indexes are compared with JS constants (1055, 1090, 1100); toasts never receive `.show`.
- `ul.fancytree-container li` has `contain: layout paint`, which clips outer shadows and offset focus rings
  on tree rows. Use inset effects.

## Gates at baseline

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | Green |
| `pnpm --filter client stylelint` | **Red before any change**: 142 `property-layout-mappings` violations (physical instead of logical properties) in 53 files, led by `stylesheets/style.css` (18), `widgets/dialogs/OptionsDialog.css` (12), `setup.css` (8), `llm_chat/ChatMessage.css` (7). Gate for re-theme work: no new violations, and every file under `stylesheets/theme-lumen/` clean. |
| Vitest | Full suites not run locally (CI runs them, per `CLAUDE.md`); each change runs the narrowest suite that covers it |
| ESLint | Not run (runs out of memory, per `CLAUDE.md`; CI does not lint) |

## Screenshot baseline

`scripts/retheme/capture-baseline.mts` captures surfaces in light and dark: 19 on the desktop layout at
768, 1280 and 1920 px, and 5 of them on the mobile layout at 360 and 768 px — 134 screenshots. It drives
a server on the e2e fixture document, which keeps every write in memory:

```bash
cd apps/server && NODE_ENV=development TRILIUM_ENV=dev TRILIUM_PORT=37999 \
  TRILIUM_DATA_DIR=spec/db \
  TRILIUM_DOCUMENT_PATH=../../packages/trilium-core/src/test/fixtures/document.db \
  TRILIUM_INTEGRATION_TEST=memory TRILIUM_RESOURCE_DIR=src npx tsx ./src/main.ts
```

```bash
node scripts/retheme/capture-baseline.mts --label baseline --channel msedge
```

`--channel` picks an installed browser (`msedge`, `chrome`); without it, Playwright's own Chromium is used.
Each phase captures under its own `--label`, so its files compare one-to-one with `baseline/`. The run
writes `manifest.json` with every capture, warning and failure. Restart the server between phases: the
fixture's in-memory state otherwise carries over.

Not covered by the matrix, and verified by hand: canvas notes (the fixture has none), spreadsheets, split
view and the right-panel peek, locales and RTL (added in Phase 5), third-party themes.

## Open questions (TDD §9)

1. **Can `defineWidget` code notes import arbitrary npm packages?** No. A JSX code note (`text/jsx`) is
   compiled by Sucrase with only the `jsx` and `imports` transforms (`buildJsx` in
   `packages/trilium-core/src/services/script.ts`), which rewrites exactly two specifiers:
   `trilium:preact` becomes `api.preact` and `trilium:api` becomes `api`. Every other `import` becomes a
   `require()` that the client resolves only against the note's child notes by title
   (`apps/client/src/services/script_context.ts`), and throws `Could not find module note` otherwise.
   Nothing is fetched from a CDN. `trilium:preact` exposes `defineWidget`, about 30 built-in components
   and the Preact and Trilium hooks, but no `preact/compat` (`forwardRef`, `createPortal`, `Component`).
   Consequences for Phase 4:
   - Radix UI, Ark UI and Base UI are **not** available to widgets authored as code notes. Bundling one
     into a child note would carry a second Preact runtime, whose hooks and context do not work with the
     app's.
   - All three work in components built into `apps/client`: `vite.config.mts` aliases `react` and
     `react-dom` to `preact/compat` and dedupes Preact. A component that note widgets should reach is
     then added to `preactAPI` (`frontend_script_api_preact.ts`) and its type in
     `packages/commons/src/lib/script_api_preact.ts`.
   - Phase 4 therefore builds its components in `apps/client`, not as code notes.
2. **CKEditor 5 variables.** Trilium vendors `ckeditor5` 48.5.0. Its `ckeditor5.css` exposes 109 distinct
   `--ck-color-*` properties plus spacing, radius, focus, shadow and z-index families. Trilium already
   overrides `--ck-*` in `stylesheets/ckeditor-theme.css` (78 declarations) and
   `theme-next/notes/text.css` (85). Phase 3 re-points those overrides at semantic tokens.
3. **Maintainer design direction.** Not checked: this audit had no access to GitHub Discussions or Matrix.
   The repository shows the direction already taken — the Next theme is the recommended "Modern" family,
   the new layout is the default, new UI is Preact under `widgets/react/`, and `building-client-ui` sets
   the component rules. A person needs to confirm before anything structural is proposed upstream.
4. **How much of v0.104/v0.105 covers Phase 2?** Most of it, for the surfaces the TDD names — see the
   verdict table above. The gap is the new layout's own chrome (status bar, breadcrumb, inline title,
   tabbed right panel), which the TDD does not list and which Phase 2 therefore adds.
5. **Legacy widgets or `defineWidget` only?** Both, without a separate path. Legacy jQuery widgets read
   the same custom properties as Preact components, so a token theme styles both. The seven jQuery
   widgets with inline `<style>` blocks (`tab_row.ts`, `quick_search.ts`, `toc.ts`, `note_tree.ts`,
   `find.ts`, `highlights_list.ts`, `watched_file_update_status.ts`) need targeted overrides.

## Where the codebase differs from the TDD's assumptions

- **Geo maps use maplibre-gl** with terra-draw, not Leaflet.
- **Settings are already Preact** (`OptionsDialog.tsx`, `Card`, `OptionCardSection`), with a mobile
  master–detail layout. Phase 4 refines them rather than rebuilding them.
- **Colour scheme is an option, not an attribute.** `THEME_FAMILY_SCHEMES` in
  `services/color_scheme.ts` maps a theme family and a scheme (system, light, dark) to a `theme` value;
  the stylesheet swap happens in `services/theme.ts`.
- **Fonts.** Inter is already bundled as a variable font with its OFL notice, and Next uses it. JetBrains
  Mono is bundled only in its Light weight (`fonts/JetBrainsMono-Light.woff2`), without a licence file
  beside it. No other weights exist in the dependency tree; adding them means vendoring new font files.
- **Tabler.** The tray icons (`scripts/icons/tray/*.svg`) are Tabler, as the decision log says, but no
  Tabler icon font or package is in the dependency tree.

## Decisions carried into Phase 1

1. **A new built-in theme family, Lumen** (`lumen`, `lumen-light`, `lumen-dark`), registered in
   `THEME_FAMILY_SCHEMES`. It loads the same Next stylesheets as the matching `next*` theme, then
   `stylesheets/theme-lumen.css`. Next is not modified, so the Next theme and every third-party theme load
   exactly as before.
2. **The same stylesheet ships as a user theme.** `theme-lumen.css` works as a code note with `#appTheme`
   and `#appThemeBase=next`, for distribution through awesome-trilium; there it follows the OS scheme.
3. **Three token layers** in `stylesheets/theme-lumen/tokens/`: primitives, semantic tokens, aliases.
   Only the semantic layer changes between light and dark.
4. **Dark cascade (TDD §3.3) on `<html>`.** The theme service sets `data-theme="light"` or `"dark"` for
   `lumen-light` and `lumen-dark`, and removes it for `lumen`. Token rules use `html:root` specificity, so
   they win over Next's `:root` declarations whichever stylesheet loads last.
5. **Alias coverage is enforced.** Every contract variable with a semantic equivalent is re-pointed; the
   rest keep Next's value and are listed by name. A spec fails when a contract variable is neither.
6. **Token lint** (TDD §6.1): a stylelint rule rejects raw colours, font sizes and spacing in
   `stylesheets/theme-lumen/**` outside the primitives, and in new component CSS.
7. **Motion.** No rule overrides `animation` on `.dropdown-menu`; transitions respect
   `prefers-reduced-motion` and the existing `body.motion-disabled` switch.
8. **Deferred to a person:** vendoring a Tabler icon font and further JetBrains Mono weights. Both add
   third-party assets to the bundle and need a licence and size review; until then icons stay Boxicons and
   monospace text uses the bundled weight with the system fallback stack.
