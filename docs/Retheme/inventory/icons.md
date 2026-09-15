# Phase 0 — Icon inventory (Boxicons → Tabler)

Trilium v0.105.0, read-only audit. Scope: UI chrome in `apps/client/src` (ts/tsx/css/html),
`packages/trilium-core/src` (hidden subtree, keyboard actions, and the few other core call sites that
set icons), `packages/commons/src`, `packages/ckeditor5/src`. Specs, `boxicons-compat.css` and the
1,635-entry note-icon picker catalogue (`icon_pack_boxicons-v2.json`) are excluded.

**398 distinct names, 1750 occurrences** — 390 glyphs plus
8 Boxicons utility classes. Those 390 glyphs collapse onto
334 distinct Tabler names.

## 1. How the icon system works today

- **Font, not SVG.** Boxicons 2.1.4 (`apps/client/package.json`) ships as a single icon font. A class
  pair `bx bx-plus` becomes a glyph through generated CSS: `.bx { font-family: 'boxicons' }` plus one
  `.bx.bx-plus::before { content: "\uXXXX" }` rule per icon.
- **That CSS comes from the icon-pack service, not a static stylesheet.**
  `packages/trilium-core/src/services/icon_packs.ts` → `getIconPacks()` returns the built-in Boxicons pack
  (prefix `bx`, manifest `icon_pack_boxicons-v2.json` = name → glyph + search terms, font served from
  `assets/fonts/boxicons.woff2`) followed by user packs. `generateCss()` emits `@font-face` + the
  per-icon rules; `apps/server/src/routes/index.ts:187` inlines it into the page, and
  `apps/server/src/share/content_renderer.ts` does the same for shared pages. Manifest `metrics` feed
  `iconFontFaceOverrides()` so glyphs of a different font centre correctly.
- **`boxicons-compat.css`** (imported by `style.css` and `print.css`) holds only Boxicons' non-glyph
  helpers: `bx-spin`/`bx-tada`/`bx-burst`/`bx-fade-*` animations, `bx-xs…bx-lg`, `bx-fw`,
  `bx-rotate-*`, `bx-flip-*`, `bx-border*`, `bx-pull-*`, and Trilium's own `bx-empty` spacer. It defines
  no glyphs.
- **Icon packs** are ordinary notes labelled `#iconPack=<prefix>` with a JSON manifest as content and a
  WOFF2/WOFF/TTF attachment. Any prefix other than `bx` is accepted, and each pack's icons join the
  note-icon picker registry (`generateIconRegistry()`). `task_states.ts` resolves a task-state icon class
  to a glyph and font family through the same packs.
- **`apps/icon-pack-builder`** turns an npm icon font into such a note and exports a zip for the website
  download page. Providers exist for Boxicons 3 (basic/brands), Material Design Icons and Phosphor
  (regular/fill). **There is no Tabler provider** (no Tabler reference anywhere in the builder), but
  `providers/mdi.ts` and `providers/phosphor.ts` are ~50-line templates, so a `tabler.ts` reading
  `@tabler/icons-webfont` would be small. `utils.ts` `extractClassNamesFromCss()` expects
  `.x::before { content: "\hex" }`, and Tabler's webfont CSS uses the single-colon `:before` form, so
  that regex needs a tweak.
- **Tabler in `node_modules`:** none, and Tabler Icons is not a dependency. Every Tabler name below is
  verified against the class list of `@tabler/icons-webfont` 3.46.0, which
  `scripts/retheme/build-lumen-icons.mts` reads from an unpacked copy of the release.

### Places a class swap alone will not reach

| Mechanism | Where | Why it matters |
|---|---|---|
| Raw codepoints in CSS `content` with a hard-coded `font-family: boxicons` | 38 escaped rules: `tree.css` (chevrons; clone, share and wrench indicators), `theme-next/{base,shell,dialogs,forms}.css`, admonition icons repeated in three files (`style.css:2876-2880`, `theme-next/notes/text.css:379-383`, `ckeditor5/src/theme/ck-content.css:55-59`), `style.css:3382,3441`, `AttributeList.css`, `NotePathsTab.css`, `ColorPicker.css`, `ckeditor5/src/theme/collapsible_list_items.css`. `font-family: boxicons` is also hard-coded in `style.css`, `print.css`, `forms.css`, `ColorPicker.css`, `NotePathsTab.css` and `AttributeList.css`. | Counted in the table below (mapped back through the manifest glyphs). Each needs a new codepoint and font family, or a switch to a class or `mask-image`. Admonitions are also rendered in shared/exported content through `ck-content.css`. |
| Literal glyph in `--task-state-glyph` | `style.css:3180`, `print.css:82` (raw U+EA41 = `bx-check` with `font-family: boxicons`); `task_states.ts` resolves per-state icons through `getIconPacks()` | Default task-state glyph; invisible to a `bx-` search (counted in the table as `bx-check`). |
| Bare names expanded at runtime | `Toast.tsx:42` (`bx bx-${icon}`), `special_notes.ts:304` (`bx bx-${opts.icon}`), `hidden_subtree.ts:531` (`bx ${item.icon}`) | Toast callers pass `"trash"`, `"export"`, `"no-signal"`, geomap draw-tool names and `"check-shield"`/`"shield"` without the prefix — 12 such names were added to the counts by hand. |
| Icons persisted into the database | `hidden_subtree*.ts` writes `#iconClass=bx …` on system and launcher notes | `checkHiddenSubtree()` creates the label only when it is missing, and re-applies a changed value only for `_help*` notes. **Changing an icon in `hidden_subtree*.ts` does not update existing databases** — that needs a migration or wider enforcement. User notes also store `bx bx-*` in `#iconClass`, and the user guide documents Boxicons names for scripts and themes, so the `bx` pack cannot be removed. |

### Broken references found in passing
- `bx-alert` (toast icon in `apps/client/src/desktop.ts:38`) and `bx-inbox`
  (`apps/client/src/widgets/ribbon/collection-properties-config.tsx:161`) are not Boxicons 2 names, so both
  render no icon today (only `bxs-inbox` exists).

## 2. Adoption paths for Tabler

Constraints: Trilium must work offline (desktop, standalone/OPFS, mobile WebView), so **no CDN** — every
asset must be vendored through npm and bundled. **Licence:** Tabler Icons is MIT, which is compatible with
Trilium's AGPL-3.0-only; the MIT notice has to ship with the bundled asset and be credited (README already
credits Tabler for the tray icons). Boxicons (Boxicons Free License, per
`apps/icon-pack-builder/boxicons-free/LICENSE.txt`) stays for user content.

| Path | How | For | Against |
|---|---|---|---|
| **A. Built-in Tabler font pack** | Add a `tabler` provider to icon-pack-builder (or bundle `@tabler/icons-webfont` next to `boxicons.woff2`), register it in `getIconPacks()` as a second built-in pack (prefix `ti`), then rewrite chrome call sites from `bx bx-*` to `ti ti-*` using this table. | Reuses the existing pipeline: generated CSS, metrics centring, share pages, task-state glyph resolution and the picker all work unchanged. Users gain Tabler in the icon picker. One font, cached. | The full outline font is large (thousands of glyphs), so subset it to the ~334 chrome names plus picker needs. Stroke weight is baked into the font. Touches ~1,750 call sites, plus the 40 codepoint rules and a migration for hidden-subtree `iconClass` labels. |
| **B. CSS remap in the theme** | A theme stylesheet overrides `.bx.bx-plus::before { font-family: tabler; content: "\…" }` for the ~390 chrome names, plus the 40 codepoint rules. Ships a subset Tabler font. | Zero TypeScript changes, reversible, and it reaches hidden-subtree and launcher icons already stored in databases. Fastest way to preview the new look. | Global side effect: every user note whose `#iconClass` uses one of those names (`bx-folder`, `bx-note`, `bx-book`, …) turns Tabler while the other ~1,200 picker icons stay Boxicons, so the tree gets a mixed look. It also creates a hidden coupling: renaming an icon in code silently drops its override. |
| **C. SVG sprite / inline SVG** | Vendor the needed `@tabler/icons` SVGs into a build-time sprite; `<Icon>` renders `<svg><use href="#ti-plus"/></svg>`; CSS `::before` uses become `mask-image`. | Crispest rendering; stroke width, size and colour are themeable per state (e.g. `stroke-width: 1.5`); tree-shaken to only the icons used; no font metrics issues. | Largest refactor: icons are passed as class strings through menus, keyboard actions, launchers, toasts, the backend script API and stored labels, all of which expect a class name. Diverges from the icon-pack model that user packs and share pages rely on. |

**Recommendation:** use **B** only as a short-lived prototype to judge the look. Then land **A**: a
subsetted, locally bundled Tabler webfont registered as a second built-in pack (`ti`), with chrome call
sites migrated from this inventory and a migration for hidden-subtree icons. Boxicons (`bx`) stays for
user-chosen note icons and scripts. Revisit C only if the theme needs per-state stroke weights a font
cannot express.

**Status:** path B runs as a preview in the Lumen theme ([Tokens](../Tokens.md#icons)). It remaps by
codepoint rather than by class, through a font placed in front of Boxicons, so it also reaches the
hard-coded codepoint rules above. Path A has not started.

## 3. Inventory

Scope of the 1750 occurrences: client 1355, client-geomap-catalogue 111, core-keyboard-actions 106, commons 82, core-hidden-subtree 70, ckeditor5 14, core-other 12.
`client-geomap-catalogue` is `osm_icons.ts`, which maps OpenStreetMap place categories to icons for geomap
search results — chrome, but a catalogue in its own right (34 names are used only there).

Grades: **exact** = same metaphor and drawing; **close** = same metaphor, different drawing (includes
every solid `bxs-*` → outline and Tabler `brand-*` renditions of `bxl-*` logos); **weak** = a
different metaphor is needed; **none** = no Tabler equivalent (a generic fallback is suggested);
**utility** = a Boxicons helper class, not a glyph. `uses` counts code occurrences, not rendered
instances. Several Boxicons names collapse onto one Tabler name (`bx-search`/`bx-search-alt` → `search`,
`bx-trash`/`bx-trash-alt` → `trash`, …).

| boxicons | uses | example locations | Tabler | grade | note |
|---|---:|---|---|---|---|
| `bx-trash` | 46 | `apps/client/src/menus/launcher_context_menu.ts:55`<br>`apps/client/src/menus/tree_context_menu.ts:326`<br>`apps/client/src/stylesheets/theme-next/base.css:282` | `trash` | exact |  |
| `bx-plus` | 41 | `apps/client/src/menus/note_context_menu.ts:133`<br>`apps/client/src/menus/tree_context_menu.ts:167`<br>`apps/client/src/menus/tree_context_menu.ts:177` | `plus` | exact |  |
| `bx-x` | 38 | `apps/client/src/stylesheets/theme-next/dialogs.css:58`<br>`apps/client/src/stylesheets/theme-next/forms.css:158`<br>`apps/client/src/stylesheets/theme-next/forms.css:159` | `x` | exact |  |
| `bx-error-circle` | 30 | `apps/client/src/services/bundle.ts:176`<br>`apps/client/src/services/toast.tsx:81`<br>`apps/client/src/services/toast.tsx:92` | `alert-circle` | exact |  |
| `bx-search` | 30 | `apps/client/src/menus/note_context_menu.ts:237`<br>`apps/client/src/menus/tree_context_menu.ts:349`<br>`apps/client/src/services/command_registry.ts:67` | `search` | exact |  |
| `bx-spin` | 30 | `apps/client/src/services/content_renderer.ts:361`<br>`apps/client/src/services/import.ts:113`<br>`apps/client/src/services/import.ts:232` | — | utility | CSS rotation modifier (boxicons-compat.css), not a glyph; keep as a theme animation class |
| `bx-empty` | 26 | `apps/client/src/menus/launcher_button_context_menu.ts:162`<br>`apps/client/src/menus/note_context_menu.ts:127`<br>`apps/client/src/widgets/buttons/global_menu.tsx:214` | — | utility | Trilium 1em blank spacer (boxicons-compat.css) used to align menu items; no glyph |
| `bx-chevron-right` | 25 | `apps/client/src/setup_restore.css:29`<br>`apps/client/src/setup_restore.tsx:398`<br>`apps/client/src/setup_restore.tsx:452` | `chevron-right` | exact |  |
| `bx-info-circle` | 22 | `apps/client/src/stylesheets/style.css:2876`<br>`apps/client/src/stylesheets/theme-next/notes/text.css:379`<br>`apps/client/src/widgets/buttons/global_menu.tsx:73` | `info-circle` | exact |  |
| `bx-rectangle` | 21 | `apps/client/src/widgets/dialogs/print_preview.tsx:315`<br>`apps/client/src/widgets/dialogs/print_preview.tsx:323`<br>`apps/client/src/widgets/mobile_widgets/TabSwitcher.tsx:41` | `rectangle` | exact | 10 of the uses are the "switch to tab N" keyboard actions; app-window might read better there |
| `bx-check` | 20 | `apps/client/src/menus/context_menu.ts:320`<br>`apps/client/src/print.css:82`<br>`apps/client/src/services/import.ts:72` | `check` | exact |  |
| `bx-cog` | 20 | `apps/client/src/widgets/buttons/global_menu.tsx:68`<br>`apps/client/src/widgets/collections/board/context_menu.ts:240`<br>`apps/client/src/widgets/collections/board/index.tsx:1265` | `settings` | exact |  |
| `bx-copy` | 20 | `apps/client/src/menus/image_context_menu.ts:29`<br>`apps/client/src/menus/note_context_menu.ts:159`<br>`apps/client/src/menus/note_context_menu.ts:175` | `copy` | exact |  |
| `bx-link-external` | 20 | `apps/client/src/menus/link_context_menu.ts:29`<br>`apps/client/src/menus/link_context_menu.ts:50`<br>`apps/client/src/menus/tree_context_menu.ts:143` | `external-link` | exact |  |
| `bx-history` | 19 | `apps/client/src/menus/tree_context_menu.ts:245`<br>`apps/client/src/services/command_registry.ts:88`<br>`apps/client/src/widgets/buttons/global_menu.tsx:50` | `history` | exact |  |
| `bx-note` | 18 | `apps/client/src/menus/launcher_context_menu.ts:44`<br>`apps/client/src/services/note_autocomplete.ts:406`<br>`apps/client/src/services/note_types.ts:35` | `note` | close |  |
| `bx-download` | 17 | `apps/client/src/services/content_renderer.ts:398`<br>`apps/client/src/setup_backup.tsx:257`<br>`apps/client/src/setup_existing.tsx:338` | `download` | exact |  |
| `bx-help-circle` | 17 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:217`<br>`apps/client/src/widgets/FloatingButtonsDefinitions.tsx:327`<br>`apps/client/src/widgets/buttons/global_menu.tsx:71` | `help-circle` | exact |  |
| `bx-data` | 15 | `apps/client/src/setup_existing.tsx:221`<br>`apps/client/src/setup_restore.tsx:441`<br>`apps/client/src/widgets/buttons/global_menu.tsx:96` | `database` | exact |  |
| `bx-dots-vertical-rounded` | 15 | `apps/client/src/stylesheets/theme-next/shell.css:963`<br>`apps/client/src/widgets/collections/board/column.tsx:665`<br>`apps/client/src/widgets/collections/board/column.tsx:709` | `dots-vertical` | exact |  |
| `bx-pin` | 15 | `apps/client/src/services/command_registry.ts:104`<br>`apps/client/src/services/command_registry.ts:117`<br>`apps/client/src/widgets/buttons/global_menu.tsx:241` | `pin` | exact |  |
| `bx-refresh` | 15 | `apps/client/src/setup.tsx:495`<br>`apps/client/src/widgets/FloatingButtonsDefinitions.tsx:83`<br>`apps/client/src/widgets/buttons/global_menu.tsx:101` | `refresh` | exact |  |
| `bx-chevron-left` | 14 | `apps/client/src/stylesheets/theme-next/base.css:356`<br>`apps/client/src/stylesheets/theme-next/base.css:372`<br>`apps/client/src/stylesheets/tree.css:65` | `chevron-left` | exact |  |
| `bx-chevron-down` | 13 | `apps/client/src/stylesheets/tree.css:111`<br>`apps/client/src/widgets/collections/legacy/ListOrGridView.tsx:218`<br>`apps/client/src/widgets/collections/table/index.tsx:49` | `chevron-down` | exact |  |
| `bx-code` | 13 | `apps/client/src/services/note_types.ts:57`<br>`apps/client/src/widgets/FloatingButtonsDefinitions.tsx:126`<br>`apps/client/src/widgets/layout/SnippetBadge.tsx:57` | `code` | exact |  |
| `bx-globe` | 13 | `apps/client/src/setup.tsx:215`<br>`apps/client/src/setup.tsx:833`<br>`apps/client/src/widgets/dialogs/export.tsx:119` | `world` | exact |  |
| `bx-loader-circle` | 13 | `apps/client/src/services/import.ts:113`<br>`apps/client/src/services/import.ts:232`<br>`apps/client/src/setup.tsx:443` | `loader-2` | close | spinner, used with bx-spin |
| `bx-map-alt` | 13 | `apps/client/src/widgets/collections/geomap/ContextMenus.ts:179`<br>`apps/client/src/widgets/collections/geomap/DetailPane.tsx:584`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:127` | `map` | exact |  |
| `bx-save` | 13 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:235`<br>`apps/client/src/widgets/bulk_actions/note/save_revision.tsx:24`<br>`apps/client/src/widgets/dialogs/revisions.tsx:251` | `device-floppy` | exact |  |
| `bx-edit` | 12 | `apps/client/src/menus/link_context_menu.ts:37`<br>`apps/client/src/menus/tree_context_menu.ts:146`<br>`apps/client/src/services/note_tooltip.ts:245` | `edit` | exact |  |
| `bx-hash` | 12 | `apps/client/src/widgets/attribute_widgets/attribute_types.ts:16`<br>`apps/client/src/widgets/collections/table/context_menu.ts:257`<br>`apps/client/src/widgets/ribbon/collection-properties-config.tsx:59` | `hash` | exact |  |
| `bx-loader` | 12 | `apps/client/src/services/content_renderer.ts:361`<br>`apps/client/src/services/content_renderer.ts:417`<br>`apps/client/src/services/content_renderer.ts:420` | `loader` | exact |  |
| `bx-sidebar` | 12 | `apps/client/src/menus/launcher_button_context_menu.ts:135`<br>`apps/client/src/services/command_registry.ts:96`<br>`apps/client/src/widgets/buttons/global_menu.tsx:66` | `layout-sidebar` | exact |  |
| `bx-archive` | 11 | `apps/client/src/menus/context_menu_utils.ts:27`<br>`apps/client/src/menus/tree_context_menu.ts:296`<br>`apps/client/src/widgets/collections/board/context_menu.ts:163` | `archive` | exact |  |
| `bx-expand-alt` | 11 | `apps/client/src/widgets/EmbeddedNotePane.css:75`<br>`apps/client/src/widgets/EmbeddedNotePane.tsx:293`<br>`apps/client/src/widgets/buttons/global_menu.tsx:222` | `arrows-diagonal` | exact |  |
| `bx-file` | 11 | `apps/client/src/services/link.ts:32`<br>`apps/client/src/widgets/attribute_widgets/attribute_detail.tsx:1024`<br>`apps/client/src/widgets/attribute_widgets/attribute_detail.tsx:1034` | `file-text` | exact |  |
| `bx-hide` | 11 | `apps/client/src/menus/launcher_context_menu.ts:51`<br>`apps/client/src/widgets/buttons/global_menu.tsx:91`<br>`apps/client/src/widgets/collections/table/context_menu.ts:82` | `eye-off` | exact |  |
| `bx-link` | 11 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:416`<br>`apps/client/src/widgets/attribute_widgets/attribute_types.ts:22`<br>`apps/client/src/widgets/collections/board/context_menu.ts:97` | `link` | exact |  |
| `bx-paperclip` | 11 | `apps/client/src/menus/tree_context_menu.ts:218`<br>`apps/client/src/services/command_registry.ts:58`<br>`apps/client/src/widgets/layout/StatusBar.tsx:363` | `paperclip` | exact |  |
| `bx-transfer` | 11 | `apps/client/src/menus/tree_context_menu.ts:280`<br>`apps/client/src/widgets/attribute_widgets/attribute_types.ts:26`<br>`apps/client/src/widgets/collections/table/context_menu.ts:268` | `arrows-exchange` | exact |  |
| `bx-book` | 10 | `apps/client/src/services/note_types.ts:39`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:65`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:66` | `book-2` | exact | closed book (Tabler book is an open book) |
| `bx-collapse-alt` | 10 | `apps/client/src/menus/tree_context_menu.ts:201`<br>`apps/client/src/widgets/collections/board/context_menu.ts:222`<br>`apps/client/src/widgets/collections/board/index.tsx:1398` | `arrows-diagonal-minimize` | exact |  |
| `bx-leaf` | 10 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:88`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:90`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:91` | `leaf` | exact |  |
| `bx-palette` | 10 | `apps/client/src/widgets/EmbeddedNotePane.tsx:340`<br>`apps/client/src/widgets/attribute_widgets/attribute_types.ts:25`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:86` | `palette` | exact |  |
| `bx-play` | 10 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:208`<br>`apps/client/src/widgets/layout/ActiveContentBadges.tsx:27`<br>`apps/client/src/widgets/layout/NoteBadges.tsx:151` | `player-play` | exact |  |
| `bx-text` | 10 | `apps/client/src/services/content_renderer.ts:288`<br>`apps/client/src/widgets/attribute_widgets/attribute_types.ts:14`<br>`apps/client/src/widgets/collections/sort_menu.ts:84` | `letter-t` | close | typography is the alternative |
| `bx-window-open` | 10 | `apps/client/src/menus/link_context_menu.ts:31`<br>`apps/client/src/menus/tree_context_menu.ts:145`<br>`apps/client/src/widgets/EmbeddedNotePane.tsx:267` | `app-window` | close | open-in-new-window; Tabler has no window-with-arrow glyph (browser-share is an alternative) |
| `bxs-network-chart` | 10 | `apps/client/src/services/note_types.ts:47`<br>`apps/client/src/services/note_types.ts:48`<br>`apps/client/src/widgets/mobile_widgets/TabSwitcher.tsx:28` | `affiliate` | close | solid source (relation map note type); Tabler outline only |
| `bx-bot` | 9 | `apps/client/src/menus/text_editor_context_menu.ts:47`<br>`apps/client/src/menus/text_editor_context_menu.ts:54`<br>`apps/client/src/widgets/dialogs/revisions.tsx:317` | `robot` | exact |  |
| `bx-columns` | 9 | `apps/client/src/services/link.ts:14`<br>`apps/client/src/widgets/collections/board/context_menu.ts:110`<br>`apps/client/src/widgets/collections/board/context_menu.ts:216` | `layout-columns` | exact |  |
| `bx-dock-right` | 9 | `apps/client/src/menus/link_context_menu.ts:30`<br>`apps/client/src/menus/tree_context_menu.ts:144`<br>`apps/client/src/widgets/EmbeddedNotePane.tsx:266` | `layout-sidebar-right` | exact |  |
| `bx-folder-open` | 9 | `apps/client/src/setup_restore.tsx:389`<br>`apps/client/src/stylesheets/theme-next/forms.css:608`<br>`apps/client/src/widgets/collections/board/index.tsx:1925` | `folder-open` | exact |  |
| `bx-loader-alt` | 9 | `apps/client/src/widgets/NoteDetail.css:29`<br>`apps/client/src/widgets/NoteDetail.tsx:328`<br>`apps/client/src/widgets/NoteDetail.tsx:332` | `loader-2` | close | spinner, used with bx-spin |
| `bx-lock-alt` | 9 | `apps/client/src/set_password.tsx:48`<br>`apps/client/src/setup_restore.tsx:441`<br>`apps/client/src/stylesheets/theme-next/shell.css:799` | `lock` | exact |  |
| `bx-message-square-dots` | 9 | `apps/client/src/menus/text_editor_context_menu.ts:58`<br>`apps/client/src/services/note_types.ts:51`<br>`apps/client/src/widgets/launch_bar/SidebarChatButton.tsx:20` | `message-dots` | exact |  |
| `bx-pencil` | 9 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:163`<br>`apps/client/src/widgets/ReadOnlyNoteInfoBar.tsx:31`<br>`apps/client/src/widgets/layout/NoteBadges.tsx:185` | `pencil` | exact |  |
| `bx-show` | 9 | `apps/client/src/menus/launcher_context_menu.ts:50`<br>`apps/client/src/menus/tree_context_menu.ts:228`<br>`apps/client/src/widgets/FloatingButtonsDefinitions.tsx:128` | `eye` | exact |  |
| `bx-directions` | 8 | `apps/client/src/menus/image_context_menu.ts:24`<br>`apps/client/src/menus/tree_context_menu.ts:244`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:145` | `direction-sign` | close |  |
| `bx-dots-horizontal-rounded` | 8 | `apps/client/src/widgets/EmbeddedNotePane.tsx:227`<br>`apps/client/src/widgets/collections/board/context_menu.ts:466`<br>`apps/client/src/widgets/dialogs/recent_changes.tsx:102` | `dots` | exact |  |
| `bx-error` | 8 | `apps/client/src/services/clipboard.ts:104`<br>`apps/client/src/stylesheets/style.css:2880`<br>`apps/client/src/stylesheets/theme-next/notes/text.css:383` | `alert-triangle` | exact |  |
| `bx-extension` | 8 | `apps/client/src/services/note_types.ts:52`<br>`apps/client/src/widgets/layout/ActiveContentBadges.tsx:128`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:189` | `puzzle` | exact |  |
| `bx-import` | 8 | `apps/client/src/menus/tree_context_menu.ts:339`<br>`apps/client/src/widgets/dialogs/import/files.tsx:189`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:154` | `file-import` | close | Boxicons draws an arrow into a tray |
| `bx-list-check` | 8 | `apps/client/src/services/task_states.ts:43`<br>`apps/client/src/widgets/layout/StatusBar.tsx:400`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:143` | `list-check` | exact |  |
| `bx-list-ul` | 8 | `apps/client/src/widgets/attribute_widgets/attribute_types.ts:18`<br>`apps/client/src/widgets/collections/board/card_template_pill.tsx:71`<br>`apps/client/src/widgets/dialogs/export.tsx:120` | `list` | exact |  |
| `bx-search-alt` | 8 | `apps/client/src/menus/note_context_menu.ts:231`<br>`apps/client/src/services/command_registry.ts:75`<br>`apps/client/src/widgets/attribute_widgets/attribute_detail.tsx:1052` | `search` | close | collapses onto the same glyph as bx-search |
| `bx-archive-out` | 7 | `apps/client/src/menus/context_menu_utils.ts:22`<br>`apps/client/src/menus/tree_context_menu.ts:296`<br>`apps/client/src/setup_backup.tsx:122` | `package-export` | close | unarchive action |
| `bx-calendar` | 7 | `apps/client/src/widgets/attribute_widgets/attribute_types.ts:19`<br>`apps/client/src/widgets/collections/calendar/GhostPopover.tsx:111`<br>`apps/client/src/widgets/collections/calendar/index.tsx:71` | `calendar` | exact |  |
| `bx-check-shield` | 7 | `apps/client/src/menus/tree_context_menu.ts:185`<br>`apps/client/src/stylesheets/theme-next/shell.css:351`<br>`apps/client/src/stylesheets/theme-next/shell.css:352` | `shield-check` | exact |  |
| `bx-collection` | 7 | `apps/client/src/widgets/NoteDetail.tsx:520`<br>`apps/client/src/widgets/collections/sort_menu.ts:82`<br>`apps/client/src/widgets/ribbon/RibbonDefinition.ts:99` | `stack-2` | close |  |
| `bx-edit-alt` | 7 | `apps/client/src/stylesheets/style.css:2438`<br>`apps/client/src/widgets/collections/board/context_menu.ts:67`<br>`apps/client/src/widgets/dialogs/revisions.tsx:607` | `pencil` | close |  |
| `bx-file-blank` | 7 | `apps/client/src/setup.tsx:311`<br>`apps/client/src/setup.tsx:553`<br>`apps/client/src/widgets/react/FileDropZone.tsx:144` | `file` | exact |  |
| `bx-file-find` | 7 | `apps/client/src/services/note_types.ts:53`<br>`apps/client/src/widgets/layout/NoteBadges.tsx:121`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:196` | `file-search` | exact |  |
| `bx-plus-circle` | 7 | `apps/client/src/widgets/collections/board/index.tsx:1928`<br>`apps/client/src/widgets/collections/geomap/MapToolbar.tsx:100`<br>`apps/client/src/widgets/react/ImageViewer.tsx:205` | `circle-plus` | exact |  |
| `bx-align-left` | 6 | `apps/client/src/widgets/attribute_widgets/attribute_types.ts:15`<br>`apps/client/src/widgets/layout/SnippetBadge.tsx:48`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:220` | `align-left` | exact |  |
| `bx-desktop` | 6 | `apps/client/src/setup.tsx:325`<br>`apps/client/src/setup.tsx:837`<br>`apps/client/src/setup.tsx:848` | `device-desktop` | exact |  |
| `bx-duplicate` | 6 | `apps/client/src/menus/tree_context_menu.ts:284`<br>`apps/client/src/widgets/collections/board/api.ts:585`<br>`apps/client/src/widgets/collections/board/index.tsx:1579` | `copy-plus` | close |  |
| `bx-image` | 6 | `apps/client/src/widgets/ribbon/RibbonDefinition.ts:69`<br>`apps/client/src/widgets/type_widgets/mind_map/NodePanel.tsx:552`<br>`apps/client/src/widgets/type_widgets/space_usage/context_menu.ts:88` | `photo` | exact |  |
| `bx-list-plus` | 6 | `apps/client/src/menus/tree_context_menu.ts:196`<br>`apps/client/src/widgets/collections/board/context_menu.ts:494`<br>`apps/client/src/widgets/react/TemplateSelectionCard.tsx:207` | `playlist-add` | close |  |
| `bx-outline` | 6 | `apps/client/src/menus/launcher_context_menu.ts:54`<br>`apps/client/src/menus/tree_context_menu.ts:290`<br>`apps/client/src/widgets/collections/board/context_menu.ts:507` | `copy` | weak | all 6 uses are Duplicate actions (tree, breadcrumb, board, launcher, template, keyboard action); Tabler has no matching outline glyph, so map by meaning |
| `bx-printer` | 6 | `apps/client/src/widgets/dialogs/print_preview.tsx:300`<br>`apps/client/src/widgets/dialogs/print_preview.tsx:407`<br>`apps/client/src/widgets/dialogs/print_preview.tsx:432` | `printer` | exact |  |
| `bx-purchase-tag` | 6 | `apps/client/src/widgets/dialogs/revisions.tsx:261`<br>`apps/client/src/widgets/dialogs/revisions.tsx:580`<br>`apps/client/src/widgets/dialogs/revisions.tsx:602` | `tag` | exact |  |
| `bx-subdirectory-right` | 6 | `apps/client/src/services/note_autocomplete.ts:412`<br>`apps/client/src/widgets/collections/board/context_menu.ts:73`<br>`apps/client/src/widgets/collections/table/context_menu.ts:193` | `corner-down-right` | exact |  |
| `bxl-markdown` | 6 | `apps/client/src/services/note_types.ts:58`<br>`apps/client/src/widgets/dialogs/export.tsx:118`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:408` | `markdown` | exact |  |
| `bxs-file-pdf` | 6 | `apps/client/src/widgets/dialogs/print_preview.tsx:290`<br>`apps/client/src/widgets/dialogs/print_preview.tsx:429`<br>`apps/client/src/widgets/type_widgets/llm_chat/ChatInputBar.tsx:300` | `file-type-pdf` | close | solid source |
| `bx-bookmark` | 5 | `apps/client/src/services/link.ts:664`<br>`apps/client/src/widgets/launch_bar/BookmarkButtons.tsx:42`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:278` | `bookmark` | exact |  |
| `bx-building-house` | 5 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:140`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:141`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:142` | `building-community` | close |  |
| `bx-bulb` | 5 | `apps/client/src/stylesheets/style.css:2877`<br>`apps/client/src/stylesheets/theme-next/notes/text.css:380`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:221` | `bulb` | exact |  |
| `bx-crosshair` | 5 | `apps/client/src/widgets/collections/geomap/ContextMenus.ts:174`<br>`apps/client/src/widgets/collections/geomap/DetailPane.tsx:671`<br>`apps/client/src/widgets/collections/geomap/SearchBox.tsx:496` | `crosshair` | exact |  |
| `bx-export` | 5 | `apps/client/src/menus/tree_context_menu.ts:341`<br>`apps/client/src/services/command_registry.ts:42`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:157` | `file-export` | close |  |
| `bx-filter-alt` | 5 | `apps/client/src/widgets/react/IconPicker.tsx:323`<br>`apps/client/src/widgets/ribbon/SearchDefinitionOptions.tsx:62`<br>`apps/client/src/widgets/type_widgets/options/shortcuts.tsx:135` | `filter` | exact |  |
| `bx-horizontal-left` | 5 | `apps/client/src/widgets/collections/board/context_menu.ts:151`<br>`apps/client/src/widgets/collections/board/context_menu.ts:317`<br>`apps/client/src/widgets/collections/table/context_menu.ts:93` | `arrow-bar-left` | close |  |
| `bx-hotel` | 5 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:80`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:81`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:82` | `bed` | close |  |
| `bx-minus-circle` | 5 | `apps/client/src/widgets/collections/geomap/MapToolbar.tsx:94`<br>`apps/client/src/widgets/react/ImageViewer.tsx:195`<br>`apps/client/src/widgets/type_widgets/helpers/SvgSplitEditor.tsx:178` | `circle-minus` | exact |  |
| `bx-paste` | 5 | `apps/client/src/menus/note_context_menu.ts:191`<br>`apps/client/src/menus/note_context_menu.ts:199`<br>`apps/client/src/menus/tree_context_menu.ts:265` | `clipboard` | close |  |
| `bx-rename` | 5 | `apps/client/src/menus/tree_context_menu.ts:212`<br>`apps/client/src/widgets/collections/board/context_menu.ts:531`<br>`apps/client/src/widgets/type_widgets/Attachment.tsx:474` | `forms` | close |  |
| `bx-reset` | 5 | `apps/client/src/menus/launcher_context_menu.ts:59`<br>`apps/client/src/widgets/react/IconPicker.tsx:315`<br>`apps/client/src/widgets/react/IconPicker.tsx:343` | `restore` | close |  |
| `bx-share-alt` | 5 | `apps/client/src/stylesheets/tree.css:177`<br>`apps/client/src/widgets/buttons/global_menu.tsx:55`<br>`apps/client/src/widgets/layout/NoteBadges.tsx:89` | `share` | exact |  |
| `bx-shield` | 5 | `apps/client/src/menus/tree_context_menu.ts:187`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:70`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:169` | `shield` | exact |  |
| `bx-sort-down` | 5 | `apps/client/src/menus/tree_context_menu.ts:238`<br>`apps/client/src/widgets/collections/SortDropdown.tsx:26`<br>`apps/client/src/widgets/collections/board/column.tsx:433` | `sort-descending` | exact |  |
| `bx-spreadsheet` | 5 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:177`<br>`packages/commons/src/lib/notes.ts:88`<br>`packages/commons/src/lib/notes.ts:89` | `file-spreadsheet` | exact |  |
| `bx-table` | 5 | `apps/client/src/services/note_types.ts:36`<br>`apps/client/src/widgets/note_bars/CollectionProperties.tsx:24`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:238` | `table` | exact |  |
| `bx-train` | 5 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:108`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:109`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:110` | `train` | exact |  |
| `bx-trash-alt` | 5 | `apps/client/src/widgets/buttons/global_menu.tsx:56`<br>`apps/client/src/widgets/dialogs/recent_changes.tsx:132`<br>`apps/client/src/widgets/type_widgets/space_usage/overview_model.ts:164` | `trash` | close | collapses onto the same glyph as bx-trash |
| `bx-world` | 5 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:125`<br>`apps/client/src/widgets/layout/ActiveContentBadges.tsx:71`<br>`apps/client/src/widgets/layout/NoteBadges.tsx:89` | `world` | exact |  |
| `bxs-chevron-right` | 5 | `apps/client/src/stylesheets/theme-next/base.css:336`<br>`apps/client/src/stylesheets/theme-next/base.css:756`<br>`apps/client/src/widgets/layout/Breadcrumb.tsx:201` | `chevron-right` | close | solid source |
| `bx-bar-chart` | 4 | `apps/client/src/widgets/mobile_widgets/mobile_detail_menu.tsx:98`<br>`apps/client/src/widgets/ribbon/RibbonDefinition.ts:113`<br>`apps/client/src/widgets/ribbon/SimilarNotesTab.tsx:48` | `chart-bar` | exact |  |
| `bx-code-curly` | 4 | `apps/client/src/menus/launcher_context_menu.ts:45`<br>`apps/client/src/services/link.ts:30`<br>`apps/client/src/widgets/layout/StatusBar.tsx:609` | `braces` | exact |  |
| `bx-comment-error` | 4 | `apps/client/src/stylesheets/style.css:2878`<br>`apps/client/src/stylesheets/theme-next/notes/text.css:381`<br>`packages/ckeditor5/src/plugins/mention/slash_commands.ts:29` | `message-report` | close | admonition caution glyph |
| `bx-copy-alt` | 4 | `apps/client/src/menus/note_context_menu.ts:166`<br>`apps/client/src/widgets/layout/NoteTypeSwitcher.tsx:133`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:290` | `copy` | close |  |
| `bx-cut` | 4 | `apps/client/src/menus/note_context_menu.ts:149`<br>`apps/client/src/menus/tree_context_menu.ts:255`<br>`packages/trilium-core/src/services/keyboard_actions.ts:241` | `cut` | exact |  |
| `bx-detail` | 4 | `apps/client/src/widgets/buttons/global_menu.tsx:95`<br>`apps/client/src/widgets/type_widgets/space_usage/context_menu.ts:83`<br>`packages/trilium-core/src/services/hidden_subtree_launcherbar.ts:85` | `list-details` | close |  |
| `bx-door-open` | 4 | `apps/client/src/menus/tree_context_menu.ts:159`<br>`apps/client/src/widgets/note_tree.ts:1906`<br>`apps/client/src/widgets/note_tree.ts:1938` | `door-exit` | close |  |
| `bx-envelope` | 4 | `apps/client/src/widgets/attribute_widgets/attribute_types.ts:23`<br>`apps/client/src/widgets/attribute_widgets/label_value_input.tsx:56`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:72` | `mail` | exact |  |
| `bx-flip-horizontal` | 4 | `apps/client/src/widgets/buttons/right_pane_toggle.tsx:19`<br>`apps/client/src/widgets/layout/StatusBar.tsx:183`<br>`packages/trilium-core/src/services/keyboard_actions.ts:741` | — | utility | CSS mirror modifier; Tabler arrows are not mirrored the same way, so check each use |
| `bx-folder` | 4 | `apps/client/src/widgets/launch_bar/BookmarkButtons.tsx:80`<br>`apps/client/src/widgets/mobile_widgets/MobileNoteNavigator.tsx:263`<br>`apps/client/src/widgets/type_widgets/options/backup.tsx:313` | `folder` | exact |  |
| `bx-football` | 4 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:93`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:94`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:95` | `ball-football` | exact |  |
| `bx-fullscreen` | 4 | `apps/client/src/widgets/collections/presentation/index.tsx:139`<br>`apps/client/src/widgets/react/OverlayControlGroup.tsx:172`<br>`apps/client/src/widgets/type_widgets/file/Video.tsx:351` | `maximize` | exact |  |
| `bx-globe-alt` | 4 | `apps/client/src/services/note_types.ts:54`<br>`apps/client/src/widgets/type_widgets/WebView.tsx:115`<br>`apps/client/src/widgets/type_widgets/WebView.tsx:138` | `world-www` | close |  |
| `bx-home` | 4 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:146`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:147`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:148` | `home` | exact |  |
| `bx-landscape` | 4 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:99`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:100`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:133` | `mountain` | close |  |
| `bx-mobile` | 4 | `apps/client/src/menus/launcher_button_context_menu.ts:135`<br>`apps/client/src/widgets/buttons/global_menu.tsx:66`<br>`apps/client/src/widgets/buttons/global_menu.tsx:143` | `device-mobile` | exact |  |
| `bx-network-chart` | 4 | `apps/client/src/widgets/note_map/MapTypeSwitcher.tsx:30`<br>`apps/client/src/widgets/sidebar/RightPaneTabs.tsx:28`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:239` | `affiliate` | close |  |
| `bx-package` | 4 | `apps/client/src/widgets/layout/ActiveContentBadges.tsx:43`<br>`apps/client/src/widgets/type_widgets/options/active_content.tsx:490`<br>`packages/trilium-core/src/services/hidden_subtree.ts:326` | `package` | exact |  |
| `bx-send` | 4 | `apps/client/src/widgets/type_widgets/options/appearance.tsx:264`<br>`apps/client/src/widgets/type_widgets/options/appearance.tsx:366`<br>`apps/client/src/widgets/type_widgets/options/appearance.tsx:375` | `send` | exact |  |
| `bx-shape-polygon` | 4 | `apps/client/src/widgets/collections/geomap/DrawToolbar.tsx:91`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:441`<br>`packages/commons/src/lib/notes.ts:111` | `polygon` | exact |  |
| `bx-sitemap` | 4 | `apps/client/src/services/note_types.ts:46`<br>`apps/client/src/widgets/note_map/MapTypeSwitcher.tsx:34`<br>`apps/client/src/widgets/sidebar/AttributeList.tsx:646` | `sitemap` | exact |  |
| `bx-terminal` | 4 | `apps/client/src/services/note_autocomplete.ts:389`<br>`packages/trilium-core/src/services/hidden_subtree.ts:147`<br>`packages/commons/src/lib/mime_type.ts:53` | `terminal-2` | exact |  |
| `bx-time` | 4 | `apps/client/src/services/note_autocomplete.ts:289`<br>`apps/client/src/widgets/attribute_widgets/attribute_types.ts:21`<br>`apps/client/src/widgets/launch_bar/SyncStatus.tsx:27` | `clock` | exact |  |
| `bx-unlink` | 4 | `apps/client/src/services/server.ts:434`<br>`apps/client/src/widgets/layout/NoteBadges.tsx:103`<br>`apps/client/src/widgets/type_widgets/Attachment.tsx:63` | `unlink` | exact |  |
| `bx-water` | 4 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:101`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:102`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:103` | `droplet` | close |  |
| `bx-wifi` | 4 | `apps/client/src/widgets/launch_bar/SyncStatus.tsx:31`<br>`apps/client/src/widgets/launch_bar/SyncStatus.tsx:36`<br>`packages/trilium-core/src/services/hidden_subtree.ts:334` | `wifi` | exact |  |
| `bx-wifi-off` | 4 | `apps/client/src/setup.tsx:787`<br>`apps/client/src/setup_restore.tsx:484`<br>`apps/client/src/widgets/launch_bar/SyncStatus.tsx:40` | `wifi-off` | exact |  |
| `bx-wrench` | 4 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:166`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:167`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:195` | `tool` | exact |  |
| `bxs-chevrons-up` | 4 | `apps/client/src/menus/tree_context_menu.ts:154`<br>`apps/client/src/widgets/layout/Breadcrumb.tsx:117`<br>`apps/client/src/widgets/layout/Breadcrumb.tsx:338` | `chevrons-up` | close | solid source |
| `bxs-dock-left` | 4 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:99`<br>`apps/client/src/widgets/FloatingButtonsDefinitions.tsx:127`<br>`apps/client/src/widgets/ribbon/NoteActionsCustom.tsx:220` | `layout-sidebar` | close | solid source |
| `bxs-keyboard` | 4 | `apps/client/src/widgets/buttons/global_menu.tsx:72`<br>`apps/client/src/widgets/type_widgets/options/shortcuts.tsx:552`<br>`packages/trilium-core/src/services/hidden_subtree.ts:318` | `keyboard` | close | solid source |
| `bxs-spreadsheet` | 4 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:308`<br>`apps/client/src/widgets/FloatingButtonsDefinitions.tsx:313`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:167` | `file-spreadsheet` | close | solid source |
| `bxs-yin-yang` | 4 | `apps/client/src/widgets/buttons/global_menu.tsx:62`<br>`apps/client/src/widgets/close_zen_button.tsx:18`<br>`packages/trilium-core/src/services/hidden_subtree_launcherbar.ts:92` | `yin-yang` | close | solid source (zen mode) |
| `bx-arrow-from-top` | 3 | `apps/client/src/widgets/ribbon/SearchDefinitionOptions.tsx:87`<br>`apps/client/src/widgets/ribbon/SearchDefinitionOptions.tsx:309`<br>`packages/trilium-core/src/services/keyboard_actions.ts:181` | `arrow-bar-down` | close |  |
| `bx-beer` | 3 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:56`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:57`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:58` | `beer` | exact |  |
| `bx-brightness-half` | 3 | `apps/client/src/widgets/launch_bar/ColorSchemeSwitcher.tsx:9`<br>`apps/client/src/widgets/type_widgets/options/appearance.tsx:59`<br>`apps/client/src/widgets/type_widgets/options/components/ThemeModeSelector.tsx:14` | `brightness-half` | exact |  |
| `bx-bug` | 3 | `apps/client/src/widgets/ribbon/SearchDefinitionOptions.tsx:104`<br>`apps/client/src/widgets/ribbon/SearchDefinitionOptions.tsx:288`<br>`apps/client/src/widgets/type_widgets/text/EditableText.tsx:562` | `bug` | exact |  |
| `bx-calendar-event` | 3 | `apps/client/src/widgets/attribute_widgets/attribute_types.ts:20`<br>`apps/client/src/widgets/collections/calendar/index.tsx:57`<br>`packages/trilium-core/src/services/keyboard_actions.ts:583` | `calendar-event` | exact |  |
| `bx-check-circle` | 3 | `apps/client/src/setup.tsx:443`<br>`apps/client/src/setup_existing.tsx:373`<br>`apps/client/src/widgets/type_widgets/options/shortcuts.tsx:196` | `circle-check` | exact |  |
| `bx-check-double` | 3 | `apps/client/src/widgets/type_widgets/options/spellcheck.tsx:146`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:216`<br>`packages/trilium-core/src/services/hidden_subtree.ts:327` | `checks` | exact |  |
| `bx-chevrons-left` | 3 | `apps/client/src/widgets/FloatingButtons.tsx:80`<br>`apps/client/src/widgets/buttons/left_pane_toggle.tsx:26`<br>`apps/client/src/widgets/collections/board/context_menu.ts:342` | `chevrons-left` | exact |  |
| `bx-clinic` | 3 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:62`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:63`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:64` | `building-hospital` | close |  |
| `bx-coffee` | 3 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:55`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:231`<br>`packages/commons/src/lib/mime_type.ts:63` | `coffee` | exact |  |
| `bx-current-location` | 3 | `apps/client/src/widgets/collections/geomap/MapToolbar.tsx:107`<br>`apps/client/src/widgets/type_widgets/mind_map/MapToolbar.tsx:79`<br>`packages/trilium-core/src/services/keyboard_actions.ts:63` | `current-location` | exact |  |
| `bx-customize` | 3 | `apps/client/src/menus/launcher_context_menu.ts:46`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:197`<br>`apps/client/src/widgets/type_widgets/Attachment.tsx:447` | `layout-dashboard` | close |  |
| `bx-fast-forward` | 3 | `apps/client/src/widgets/type_widgets/file/Audio.tsx:94`<br>`apps/client/src/widgets/type_widgets/file/Video.tsx:122`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:222` | `player-track-next` | exact |  |
| `bx-highlight` | 3 | `apps/client/src/widgets/sidebar/pdf/PdfAnnotations.tsx:13`<br>`apps/client/src/widgets/type_widgets/llm_chat/chat_highlights.ts:147`<br>`apps/client/src/widgets/type_widgets/options/highlights_list_options.tsx:42` | `highlight` | exact |  |
| `bx-home-alt` | 3 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:137`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:138`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:139` | `home-2` | close |  |
| `bx-key` | 3 | `apps/client/src/widgets/type_widgets/ProtectedSession.tsx:24`<br>`apps/client/src/widgets/type_widgets/options/etapi.tsx:120`<br>`apps/client/src/widgets/type_widgets/options/password.tsx:417` | `key` | exact |  |
| `bx-layer` | 3 | `apps/client/src/widgets/collections/calendar/index.tsx:78`<br>`apps/client/src/widgets/layout/ActiveContentBadges.tsx:145`<br>`apps/client/src/widgets/sidebar/AttributeList.tsx:898` | `stack` | exact |  |
| `bx-layer-minus` | 3 | `apps/client/src/widgets/note_tree.ts:114`<br>`apps/client/src/widgets/ribbon/collection-properties-config.tsx:27`<br>`packages/trilium-core/src/services/keyboard_actions.ts:95` | `stack-pop` | close | collapse tree |
| `bx-library` | 3 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:69`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:85`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:164` | `books` | close |  |
| `bx-log-in` | 3 | `apps/client/src/services/content_renderer.ts:128`<br>`apps/client/src/widgets/EmbeddedNotePane.tsx:214`<br>`apps/client/src/widgets/type_widgets/options/password.tsx:369` | `login` | exact |  |
| `bx-menu` | 3 | `apps/client/src/widgets/buttons/global_menu.tsx:38`<br>`apps/client/src/widgets/type_widgets/options/appearance.tsx:365`<br>`apps/client/src/widgets/type_widgets/options/appearance.tsx:374` | `menu-2` | exact |  |
| `bx-move` | 3 | `apps/client/src/widgets/collections/geomap/ContextMenus.ts:164`<br>`apps/client/src/widgets/collections/geomap/DetailPane.tsx:603`<br>`apps/client/src/widgets/collections/geomap/index.tsx:333` | `arrows-move` | exact |  |
| `bx-move-vertical` | 3 | `apps/client/src/widgets/collections/sort_menu.ts:83`<br>`apps/client/src/widgets/ribbon/collection-properties-config.tsx:43`<br>`packages/trilium-core/src/services/hidden_subtree.ts:224` | `arrows-move-vertical` | exact |  |
| `bx-movie` | 3 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:76`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:77`<br>`apps/client/src/widgets/type_widgets/file/MediaProxy.tsx:19` | `movie` | exact |  |
| `bx-music` | 3 | `apps/client/src/widgets/type_widgets/file/Audio.tsx:68`<br>`apps/client/src/widgets/type_widgets/file/MediaProxy.tsx:19`<br>`packages/commons/src/lib/notes.ts:190` | `music` | exact |  |
| `bx-paper-plane` | 3 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:119`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:120`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:162` | `send` | close | geomap place icon; plane reads better for airports |
| `bx-pen` | 3 | `apps/client/src/services/note_types.ts:42`<br>`apps/client/src/widgets/sidebar/pdf/PdfAnnotations.tsx:14`<br>`packages/commons/src/lib/notes.ts:19` | `ballpen` | close | canvas note type |
| `bx-pie-chart-alt-2` | 3 | `apps/client/src/widgets/buttons/global_menu.tsx:57`<br>`packages/trilium-core/src/services/hidden_subtree.ts:137`<br>`packages/trilium-core/src/services/keyboard_actions.ts:530` | `chart-pie` | exact |  |
| `bx-right-arrow-alt` | 3 | `apps/client/src/widgets/TabHistoryNavigationButtons.tsx:29`<br>`apps/client/src/widgets/type_widgets/mind_map/context_menu.ts:45`<br>`packages/trilium-core/src/services/keyboard_actions.ts:462` | `arrow-right` | exact |  |
| `bx-server` | 3 | `apps/client/src/setup.tsx:318`<br>`apps/client/src/setup.tsx:848`<br>`apps/client/src/widgets/layout/ActiveContentBadges.tsx:48` | `server` | exact |  |
| `bx-shape-circle` | 3 | `apps/client/src/widgets/collections/geomap/DrawToolbar.tsx:93`<br>`packages/commons/src/lib/notes.ts:112`<br>`apps/client/src/widgets/collections/geomap/index.tsx:653` | `circle` | close |  |
| `bx-shape-square` | 3 | `apps/client/src/widgets/collections/geomap/DrawToolbar.tsx:92`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:212`<br>`packages/commons/src/lib/attachment_roles.ts:97` | `square` | close |  |
| `bx-slider` | 3 | `apps/client/src/widgets/ribbon/RibbonDefinition.ts:77`<br>`apps/client/src/widgets/type_widgets/options/appearance.tsx:312`<br>`packages/trilium-core/src/services/keyboard_actions.ts:656` | `adjustments-horizontal` | exact |  |
| `bx-sort-up` | 3 | `apps/client/src/widgets/collections/SortDropdown.tsx:26`<br>`apps/client/src/widgets/collections/board/column.tsx:433`<br>`apps/client/src/widgets/collections/sort_menu.ts:93` | `sort-ascending` | exact |  |
| `bx-star` | 3 | `apps/client/src/setup.tsx:548`<br>`apps/client/src/widgets/type_widgets/options/appearance.tsx:47`<br>`packages/trilium-core/src/services/keyboard_actions.ts:700` | `star` | exact |  |
| `bx-stop` | 3 | `apps/client/src/widgets/ribbon/SearchDefinitionOptions.tsx:96`<br>`apps/client/src/widgets/ribbon/SearchDefinitionOptions.tsx:351`<br>`apps/client/src/widgets/type_widgets/llm_chat/ChatInputBar.tsx:534` | `player-stop` | exact |  |
| `bx-sun` | 3 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:106`<br>`apps/client/src/widgets/launch_bar/ColorSchemeSwitcher.tsx:10`<br>`apps/client/src/widgets/type_widgets/options/appearance.tsx:60` | `sun` | exact |  |
| `bx-tada` | 3 | `apps/client/src/stylesheets/theme-next/shell.css:1823`<br>`apps/client/src/stylesheets/theme-next/shell.css:1828`<br>`apps/client/src/widgets/FloatingButtonsDefinitions.tsx:154` | — | utility | CSS wobble animation modifier; not a glyph |
| `bx-time-five` | 3 | `apps/client/src/widgets/collections/board/card.tsx:330`<br>`apps/client/src/widgets/dialogs/revisions.tsx:314`<br>`apps/client/src/widgets/type_widgets/space_usage/cleanup_dialog.tsx:334` | `clock-hour-5` | exact |  |
| `bx-trip` | 3 | `apps/client/src/widgets/collections/geomap/EditToolbar.tsx:61`<br>`apps/client/src/widgets/type_widgets/file/GpxPreview.tsx:108`<br>`packages/commons/src/lib/notes.ts:86` | `route` | close | GPX track |
| `bx-undo` | 3 | `apps/client/src/widgets/mobile_widgets/TabSwitcher.tsx:79`<br>`apps/client/src/widgets/tab_row.ts:403`<br>`packages/trilium-core/src/services/keyboard_actions.ts:296` | `arrow-back-up` | exact |  |
| `bx-vector` | 3 | `apps/client/src/widgets/collections/geomap/DrawToolbar.tsx:90`<br>`packages/commons/src/lib/notes.ts:110`<br>`apps/client/src/widgets/collections/geomap/index.tsx:635` | `vector` | exact |  |
| `bx-walk` | 3 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:114`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:115`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:116` | `walk` | exact |  |
| `bxl-html5` | 3 | `apps/client/src/widgets/dialogs/export.tsx:117`<br>`apps/client/src/widgets/type_widgets/Render.tsx:130`<br>`packages/commons/src/lib/mime_type.ts:102` | `brand-html5` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-javascript` | 3 | `packages/commons/src/lib/mime_type.ts:108`<br>`packages/commons/src/lib/mime_type.ts:109`<br>`packages/commons/src/lib/mime_type.ts:110` | `brand-javascript` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxs-file-doc` | 3 | `packages/commons/src/lib/notes.ts:22`<br>`packages/commons/src/lib/notes.ts:84`<br>`packages/commons/src/lib/notes.ts:85` | `file-type-doc` | close | solid source |
| `bxs-tag-x` | 3 | `apps/client/src/services/note_autocomplete.ts:287`<br>`apps/client/src/widgets/attribute_widgets/label_value_input.tsx:211`<br>`apps/client/src/widgets/type_widgets/options/active_content.tsx:317` | `backspace` | weak | clears the autocomplete field; tag-off is the glyph-level match |
| `bxs-widget` | 3 | `apps/client/src/widgets/layout/ActiveContentBadges.tsx:100`<br>`apps/client/src/widgets/layout/ActiveContentBadges.tsx:107`<br>`packages/commons/src/lib/notes.ts:23` | `components` | close | solid source |
| `bxs-zap` | 3 | `apps/client/src/widgets/ribbon/SearchDefinitionTab.tsx:173`<br>`apps/client/src/widgets/ribbon/SearchDefinitionTab.tsx:182`<br>`apps/client/src/widgets/ribbon/SearchDefinitionTab.tsx:223` | `bolt` | close | solid source |
| `bx-archive-in` | 2 | `apps/client/src/setup.tsx:333`<br>`apps/client/src/setup_restore.tsx:225` | `package-import` | close |  |
| `bx-arrow-back` | 2 | `apps/client/src/widgets/react/SetupPage.tsx:45`<br>`apps/client/src/widgets/type_widgets/space_usage/browse.tsx:163` | `arrow-left` | close |  |
| `bx-arrow-to-right` | 2 | `apps/client/src/services/note_autocomplete.ts:295`<br>`apps/client/src/widgets/type_widgets/file/media_play_mode.ts:23` | `arrow-bar-to-right` | exact |  |
| `bx-book-open` | 2 | `apps/client/src/setup.tsx:552`<br>`apps/client/src/widgets/type_widgets/llm_chat/ToolCallCard.tsx:63` | `book` | exact |  |
| `bx-bracket` | 2 | `apps/client/src/widgets/type_widgets/mind_map/context_menu.ts:47`<br>`packages/commons/src/lib/mime_type.ts:192` | `brackets` | exact |  |
| `bx-brain` | 2 | `apps/client/src/widgets/type_widgets/llm_chat/ChatInputBar.tsx:498`<br>`apps/client/src/widgets/type_widgets/llm_chat/ChatMessage.tsx:152` | `brain` | exact |  |
| `bx-briefcase` | 2 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:165`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:230` | `briefcase` | exact |  |
| `bx-bug-alt` | 2 | `apps/client/src/widgets/buttons/global_menu.tsx:100`<br>`packages/trilium-core/src/services/keyboard_actions.ts:818` | `bug` | close |  |
| `bx-building` | 2 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:155`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:163` | `building` | exact |  |
| `bx-buildings` | 2 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:135`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:136` | `buildings` | exact |  |
| `bx-bus` | 2 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:78`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:113` | `bus` | exact |  |
| `bx-calendar-week` | 2 | `apps/client/src/widgets/collections/calendar/index.tsx:64`<br>`apps/client/src/widgets/ribbon/collection-properties-config.tsx:53` | `calendar-week` | exact |  |
| `bx-checkbox` | 2 | `packages/trilium-core/src/services/hidden_subtree.ts:114`<br>`packages/commons/src/lib/task_states.ts:47` | `square` | close | empty checkbox (Tabler checkbox is ticked) |
| `bx-chevron-up` | 2 | `apps/client/src/widgets/sidebar/AttributeList.css:78`<br>`apps/client/src/widgets/type_widgets/mind_map/context_menu.ts:41` | `chevron-up` | exact |  |
| `bx-chip` | 2 | `apps/client/src/widgets/buttons/global_menu.tsx:90`<br>`apps/client/src/widgets/type_widgets/text/ai_model_picker.ts:39` | `cpu` | exact |  |
| `bx-circle` | 2 | `apps/client/src/setup.tsx:443`<br>`apps/client/src/widgets/collections/board/columns.ts:18` | `circle` | exact |  |
| `bx-code-alt` | 2 | `apps/client/src/widgets/dialogs/revisions.tsx:316`<br>`packages/commons/src/lib/mime_type.ts:209` | `code` | close |  |
| `bx-collapse` | 2 | `apps/client/src/menus/tree_context_menu.ts:225`<br>`apps/client/src/widgets/type_widgets/file/Video.tsx:289` | `arrows-minimize` | exact |  |
| `bx-collapse-vertical` | 2 | `apps/client/src/widgets/ribbon/NoteMapTab.tsx:41`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:225` | `fold` | exact |  |
| `bx-dots-horizontal` | 2 | `apps/client/src/menus/launcher_context_menu.ts:47`<br>`packages/trilium-core/src/services/hidden_subtree.ts:347` | `dots` | close |  |
| `bx-exit` | 2 | `apps/client/src/widgets/type_widgets/file/Video.tsx:332`<br>`apps/client/src/widgets/type_widgets/mind_map/MapToolbar.tsx:53` | `logout` | exact |  |
| `bx-exit-fullscreen` | 2 | `apps/client/src/widgets/react/OverlayControlGroup.tsx:172`<br>`apps/client/src/widgets/type_widgets/file/Video.tsx:351` | `minimize` | exact |  |
| `bx-expand` | 2 | `apps/client/src/menus/tree_context_menu.ts:224`<br>`apps/client/src/widgets/type_widgets/file/Video.tsx:289` | `arrows-maximize` | exact |  |
| `bx-expand-vertical` | 2 | `apps/client/src/widgets/ribbon/NoteMapTab.tsx:34`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:226` | `arrows-vertical` | close | Tabler has no `unfold` |
| `bx-first-aid` | 2 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:71`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:170` | `first-aid-kit` | exact |  |
| `bx-horizontal-right` | 2 | `apps/client/src/widgets/collections/board/context_menu.ts:323`<br>`apps/client/src/widgets/collections/table/context_menu.ts:102` | `arrow-bar-right` | close |  |
| `bx-layout` | 2 | `apps/client/src/menus/launcher_button_context_menu.ts:144`<br>`packages/trilium-core/src/services/hidden_subtree.ts:316` | `layout` | exact |  |
| `bx-left-arrow-alt` | 2 | `apps/client/src/widgets/TabHistoryNavigationButtons.tsx:22`<br>`packages/trilium-core/src/services/keyboard_actions.ts:454` | `arrow-left` | exact |  |
| `bx-lock` | 2 | `apps/client/src/widgets/dialogs/password_not_set.tsx:16`<br>`packages/trilium-core/src/services/hidden_subtree.ts:344` | `lock` | close |  |
| `bx-lock-open-alt` | 2 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:112`<br>`apps/client/src/widgets/layout/NoteBadges.tsx:40` | `lock-open` | exact |  |
| `bx-low-vision` | 2 | `apps/client/src/widgets/dialogs/revisions.tsx:713`<br>`packages/trilium-core/src/services/keyboard_actions.ts:117` | `eye-off` | close | collapses onto the same glyph as bx-hide |
| `bx-minus` | 2 | `apps/client/src/widgets/buttons/global_menu.tsx:224`<br>`packages/trilium-core/src/services/keyboard_actions.ts:289` | `minus` | exact |  |
| `bx-moon` | 2 | `apps/client/src/widgets/launch_bar/ColorSchemeSwitcher.tsx:11`<br>`apps/client/src/widgets/type_widgets/options/appearance.tsx:61` | `moon` | exact |  |
| `bx-notepad` | 2 | `apps/client/src/widgets/type_widgets/mind_map/NodePanel.tsx:156`<br>`apps/client/src/widgets/type_widgets/mind_map/NodePanel.tsx:316` | `notebook` | close |  |
| `bx-phone` | 2 | `apps/client/src/widgets/attribute_widgets/attribute_types.ts:24`<br>`apps/client/src/widgets/attribute_widgets/label_value_input.tsx:61` | `phone` | exact |  |
| `bx-plus-medical` | 2 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:61`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:168` | `medical-cross` | exact |  |
| `bx-revision` | 2 | `apps/client/src/widgets/type_widgets/llm_chat/ChatMessage.tsx:184`<br>`apps/client/src/widgets/type_widgets/llm_chat/chat_context_menu.ts:159` | `reload` | close | LLM retry |
| `bx-rewind` | 2 | `apps/client/src/widgets/type_widgets/file/Audio.tsx:92`<br>`apps/client/src/widgets/type_widgets/file/Video.tsx:120` | `player-track-prev` | exact |  |
| `bx-rocket` | 2 | `packages/trilium-core/src/services/llm/system_prompt.ts:57`<br>`packages/trilium-core/src/services/llm/tools/icon_tools.ts:16` | `rocket` | exact |  |
| `bx-rotate-90` | 2 | `apps/client/src/widgets/collections/table/context_menu.ts:181`<br>`apps/client/src/widgets/dialogs/print_preview.tsx:315` | — | utility | CSS rotation modifier (print preview portrait uses bx-rectangle bx-rotate-90) |
| `bx-rss` | 2 | `apps/client/src/widgets/layout/ActiveContentBadges.tsx:58`<br>`apps/client/src/widgets/layout/ActiveContentBadges.tsx:88` | `rss` | exact |  |
| `bx-ruler` | 2 | `apps/client/src/widgets/ribbon/collection-properties-config.tsx:125`<br>`apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:210` | `ruler` | exact |  |
| `bx-run` | 2 | `apps/client/src/widgets/ribbon/SearchDefinitionOptions.tsx:70`<br>`apps/client/src/widgets/ribbon/SearchDefinitionOptions.tsx:280` | `run` | exact |  |
| `bx-selection` | 2 | `apps/client/src/services/note_types.ts:43`<br>`packages/commons/src/lib/notes.ts:18` | `marquee-2` | close | mermaid note type |
| `bx-shield-quarter` | 2 | `apps/client/src/widgets/launch_bar/ProtectedSessionStatusWidget.tsx:21`<br>`packages/trilium-core/src/services/hidden_subtree_launcherbar.ts:181` | `shield-half` | close |  |
| `bx-shopping-bag` | 2 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:50`<br>`apps/client/src/widgets/collections/geomap/osm_icons.ts:51` | `shopping-bag` | exact |  |
| `bx-skip-next` | 2 | `apps/client/src/widgets/type_widgets/file/MediaPlayer.tsx:506`<br>`packages/trilium-core/src/services/keyboard_actions.ts:305` | `player-skip-forward` | exact |  |
| `bx-skip-previous` | 2 | `apps/client/src/widgets/type_widgets/file/MediaPlayer.tsx:506`<br>`packages/trilium-core/src/services/keyboard_actions.ts:313` | `player-skip-back` | exact |  |
| `bx-sort-alt-2` | 2 | `apps/client/src/widgets/collections/board/context_menu.ts:140`<br>`apps/client/src/widgets/collections/table/context_menu.ts:45` | `arrows-sort` | exact |  |
| `bx-square` | 2 | `apps/client/src/widgets/attribute_widgets/UserAttributesList.tsx:109`<br>`apps/client/src/widgets/type_widgets/mind_map/NodePanel.tsx:553` | `square` | exact |  |
| `bx-tachometer` | 2 | `apps/client/src/widgets/collections/board/context_menu.ts:145`<br>`apps/client/src/widgets/type_widgets/file/MediaPlayer.tsx:644` | `gauge` | exact |  |
| `bx-up-arrow-alt` | 2 | `apps/client/src/widgets/type_widgets/llm_chat/ChatInputBar.tsx:534`<br>`packages/trilium-core/src/services/keyboard_actions.ts:160` | `arrow-up` | exact |  |
| `bx-vertical-top` | 2 | `apps/client/src/widgets/collections/board/context_menu.ts:288`<br>`apps/client/src/widgets/collections/board/context_menu.ts:513` | `arrow-bar-to-up` | exact |  |
| `bx-volume-mute` | 2 | `apps/client/src/widgets/type_widgets/file/Audio.tsx:47`<br>`apps/client/src/widgets/type_widgets/file/MediaPlayer.tsx:212` | `volume-3` | exact |  |
| `bx-window` | 2 | `apps/client/src/widgets/layout/ActiveContentBadges.tsx:77`<br>`apps/client/src/widgets/layout/ActiveContentBadges.tsx:113` | `app-window` | exact |  |
| `bx-window-alt` | 2 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:226`<br>`apps/client/src/widgets/layout/ActiveContentBadges.tsx:203` | `browser` | close |  |
| `bx-x-circle` | 2 | `apps/client/src/menus/launcher_button_context_menu.ts:85`<br>`apps/client/src/widgets/collections/table/context_menu.ts:74` | `circle-x` | exact |  |
| `bxl-java` | 2 | `packages/commons/src/lib/mime_type.ts:106`<br>`packages/commons/src/lib/mime_type.ts:107` | `file-code` | none | no Java logo in Tabler; generic code-file fallback |
| `bxs-chevron-down` | 2 | `apps/client/src/widgets/find.ts:80`<br>`apps/client/src/widgets/react/ColorPicker.css:65` | `chevron-down` | close | solid source |
| `bxs-chevron-left` | 2 | `packages/trilium-core/src/services/hidden_subtree_launcherbar.ts:22`<br>`packages/trilium-core/src/services/keyboard_actions.ts:21` | `chevron-left` | close | solid source |
| `bxs-comment-detail` | 2 | `apps/client/src/widgets/sidebar/pdf/PdfAnnotations.tsx:11`<br>`apps/client/src/widgets/sidebar/pdf/PdfAnnotations.tsx:56` | `message-2` | close | solid source |
| `bxs-dashboard` | 2 | `apps/client/src/widgets/note_bars/CollectionProperties.tsx:28`<br>`packages/trilium-core/src/services/hidden_subtree_templates.ts:388` | `layout-dashboard` | close | solid source |
| `bxs-dock-bottom` | 2 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:99`<br>`apps/client/src/widgets/ribbon/NoteActionsCustom.tsx:220` | `layout-bottombar` | close | solid source |
| `bxs-file-blank` | 2 | `apps/client/src/widgets/type_widgets/llm_chat/ChatInputBar.tsx:300`<br>`apps/client/src/widgets/type_widgets/llm_chat/ChatMessage.tsx:305` | `file` | close | solid source |
| `bxs-file-css` | 2 | `apps/client/src/widgets/layout/ActiveContentBadges.tsx:123`<br>`packages/commons/src/lib/mime_type.ts:67` | `file-type-css` | close | solid source |
| `bxs-file-image` | 2 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:289`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:431` | `photo` | close | solid source |
| `bxs-file-json` | 2 | `packages/commons/src/lib/mime_type.ts:112`<br>`packages/commons/src/lib/mime_type.ts:113` | `json` | close | solid source |
| `bxs-file-png` | 2 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:295`<br>`apps/client/src/widgets/ribbon/NoteActions.tsx:436` | `file-type-png` | close | solid source |
| `bxs-grid` | 2 | `apps/client/src/widgets/note_bars/CollectionProperties.tsx:21`<br>`packages/trilium-core/src/services/hidden_subtree_templates.ts:124` | `layout-grid` | close | solid source |
| `bxs-inbox` | 2 | `apps/client/src/widgets/collections/board/columns.ts:33`<br>`packages/trilium-core/src/services/keyboard_actions.ts:145` | `inbox` | close | solid source |
| `bxs-wrench` | 2 | `apps/client/src/menus/tree_context_menu.ts:193`<br>`apps/client/src/stylesheets/tree.css:217` | `tool` | close | solid source |
| `bx-adjust` | 1 | `packages/trilium-core/src/services/hidden_subtree_launcherbar.ts:99` | `contrast` | close | colour-scheme switcher launcher |
| `bx-alert` | 1 | `apps/client/src/desktop.ts:38` | `alert-triangle` | weak | NOT a Boxicons 2 name: the critical-error toast (desktop.ts:38) renders no icon today |
| `bx-align-justify` | 1 | `apps/client/src/widgets/ribbon/NoteActions.tsx:230` | `align-justified` | exact |  |
| `bx-analyse` | 1 | `apps/client/src/widgets/launch_bar/SyncStatus.tsx:49` | `refresh` | close | sync in progress, spins |
| `bx-arrow-from-bottom` | 1 | `packages/trilium-core/src/services/keyboard_actions.ts:174` | `arrow-bar-up` | close |  |
| `bx-arrow-from-left` | 1 | `apps/client/src/widgets/type_widgets/file/media_play_mode.ts:25` | `arrow-bar-right` | close |  |
| `bx-basket` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:48` | `basket` | exact |  |
| `bx-block` | 1 | `packages/commons/src/lib/task_states.ts:62` | `ban` | exact |  |
| `bx-bold` | 1 | `apps/client/src/widgets/type_widgets/options/highlights_list_options.tsx:38` | `bold` | exact |  |
| `bx-book-content` | 1 | `apps/client/src/widgets/layout/ActiveContentBadges.tsx:198` | `book` | close |  |
| `bx-bookmarks` | 1 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:195` | `bookmarks` | exact |  |
| `bx-bowl-hot` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:54` | `soup` | close |  |
| `bx-broadcast` | 1 | `apps/client/src/setup.tsx:795` | `broadcast` | exact |  |
| `bx-brush` | 1 | `apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:217` | `brush` | exact |  |
| `bx-brush-alt` | 1 | `apps/client/src/widgets/type_widgets/space_usage/index.tsx:98` | `brush` | close |  |
| `bx-cake` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:49` | `cake` | exact |  |
| `bx-calendar-alt` | 1 | `apps/client/src/widgets/type_widgets/mind_map/NodePanel.tsx:317` | `calendar-month` | close |  |
| `bx-calendar-edit` | 1 | `apps/client/src/widgets/ribbon/RibbonDefinition.ts:47` | `calendar-cog` | weak | no calendar-with-pencil glyph known; compose or pick per call site |
| `bx-calendar-plus` | 1 | `apps/client/src/widgets/collections/sort_menu.ts:85` | `calendar-plus` | exact |  |
| `bx-calendar-star` | 1 | `packages/trilium-core/src/services/hidden_subtree_launcherbar.ts:16` | `calendar-star` | exact |  |
| `bx-camera` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:156` | `camera` | exact |  |
| `bx-card` | 1 | `apps/client/src/widgets/collections/board/reference.ts:155` | `cards` | close |  |
| `bx-carousel` | 1 | `apps/client/src/widgets/collections/table/index.tsx:70` | `carousel-horizontal` | exact |  |
| `bx-cart` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:47` | `shopping-cart` | exact |  |
| `bx-category-alt` | 1 | `apps/client/src/widgets/collections/board/group_by.tsx:107` | `category-2` | close |  |
| `bx-check-square` | 1 | `apps/client/src/widgets/attribute_widgets/UserAttributesList.tsx:109` | `square-check` | exact |  |
| `bx-chevron-right-square` | 1 | `packages/trilium-core/src/services/hidden_subtree_launcherbar.ts:78` | `square-chevron-right` | exact |  |
| `bx-chevrons-down` | 1 | `apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:241` | `chevrons-down` | exact |  |
| `bx-chevrons-right` | 1 | `apps/client/src/widgets/FloatingButtons.tsx:94` | `chevrons-right` | exact |  |
| `bx-chevrons-up` | 1 | `packages/trilium-core/src/services/keyboard_actions.ts:795` | `chevrons-up` | exact |  |
| `bx-church` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:75` | `building-church` | exact |  |
| `bx-cloud-download` | 1 | `apps/client/src/widgets/type_widgets/BlobStub.tsx:21` | `cloud-download` | exact |  |
| `bx-cloud-upload` | 1 | `apps/client/src/widgets/react/FileDropZone.tsx:159` | `cloud-upload` | exact |  |
| `bx-code-block` | 1 | `apps/client/src/services/backend_scripting.ts:35` | `source-code` | close |  |
| `bx-collapse-horizontal` | 1 | `apps/client/src/widgets/collections/board/context_menu.ts:128` | `arrow-autofit-width` | weak | no horizontal fold glyph; fold rotated 90deg is the alternative |
| `bx-comment` | 1 | `apps/client/src/widgets/sidebar/pdf/PdfAnnotations.tsx:57` | `message` | exact |  |
| `bx-conversation` | 1 | `apps/client/src/widgets/type_widgets/llm_chat/ChatMessageList.tsx:66` | `messages` | exact |  |
| `bx-credit-card` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:60` | `credit-card` | exact |  |
| `bx-cycling` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:117` | `bike` | close |  |
| `bx-down-arrow-alt` | 1 | `packages/trilium-core/src/services/keyboard_actions.ts:167` | `arrow-down` | exact |  |
| `bx-dumbbell` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:97` | `barbell` | exact |  |
| `bx-eraser` | 1 | `apps/client/src/widgets/type_widgets/llm_chat/chat_highlights.ts:143` | `eraser` | exact |  |
| `bx-expand-horizontal` | 1 | `apps/client/src/widgets/ribbon/NoteActions.tsx:298` | `arrows-horizontal` | close |  |
| `bx-flag` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:126` | `flag` | exact |  |
| `bx-font` | 1 | `packages/commons/src/lib/notes.ts:191` | `typography` | close |  |
| `bx-font-color` | 1 | `apps/client/src/widgets/type_widgets/options/highlights_list_options.tsx:41` | `text-color` | exact |  |
| `bx-gas-pump` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:73` | `gas-station` | exact |  |
| `bx-git-merge` | 1 | `apps/client/src/widgets/type_widgets/mind_map/context_menu.ts:38` | `git-merge` | exact |  |
| `bx-glasses` | 1 | `apps/client/src/widgets/type_widgets/options/database.tsx:478` | `eyeglass` | exact |  |
| `bx-grid-horizontal` | 1 | `apps/client/src/widgets/collections/presentation/index.tsx:132` | `layout-grid` | close |  |
| `bx-hdd` | 1 | `packages/trilium-core/src/services/hidden_subtree.ts:341` | `server-2` | weak | no hard-disk glyph known (backup options note) |
| `bx-heart` | 1 | `apps/client/src/widgets/dialogs/about.tsx:151` | `heart` | exact |  |
| `bx-home-alt-2` | 1 | `packages/commons/src/lib/notes.ts:143` | `home-2` | close |  |
| `bx-image-add` | 1 | `apps/client/src/widgets/type_widgets/mind_map/NodePanel.tsx:510` | `photo-plus` | exact |  |
| `bx-image-alt` | 1 | `packages/commons/src/lib/attachment_roles.ts:93` | `photo` | close |  |
| `bx-images` | 1 | `apps/client/src/widgets/type_widgets/icon_pack/IconPackPreview.tsx:62` | `library-photo` | close |  |
| `bx-inbox` | 1 | `apps/client/src/widgets/ribbon/collection-properties-config.tsx:161` | `inbox` | close | NOT a Boxicons 2 name (only bxs-inbox exists): collection-properties-config.tsx:161 renders no icon today |
| `bx-info-square` | 1 | `apps/client/src/widgets/ribbon/RibbonDefinition.ts:54` | `info-square` | exact |  |
| `bx-italic` | 1 | `apps/client/src/widgets/type_widgets/options/highlights_list_options.tsx:39` | `italic` | exact |  |
| `bx-label` | 1 | `apps/client/src/widgets/ribbon/collection-properties-config.tsx:131` | `label` | exact |  |
| `bx-layer-plus` | 1 | `packages/trilium-core/src/services/keyboard_actions.ts:87` | `stack-push` | close |  |
| `bx-lg` | 1 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:154` | — | utility | CSS size modifier |
| `bx-link-alt` | 1 | `apps/client/src/stylesheets/tree.css:173` | `link` | close | clone indicator in tree.css (codepoint) |
| `bx-list-ol` | 1 | `apps/client/src/widgets/collections/calendar/index.tsx:85` | `list-numbers` | exact |  |
| `bx-log-in-circle` | 1 | `apps/client/src/setup.tsx:301` | `login-2` | close |  |
| `bx-log-out` | 1 | `apps/client/src/widgets/buttons/global_menu.tsx:109` | `logout` | exact |  |
| `bx-map-pin` | 1 | `apps/client/src/widgets/collections/geomap/geocoding.ts:29` | `map-pin` | exact |  |
| `bx-medal` | 1 | `apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:234` | `medal` | exact |  |
| `bx-mobile-alt` | 1 | `apps/client/src/setup.tsx:835` | `device-mobile` | close |  |
| `bx-money` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:59` | `cash` | exact |  |
| `bx-no-signal` | 1 | `apps/client/src/services/ws.ts:303` | `antenna-bars-off` | close |  |
| `bx-pause` | 1 | `apps/client/src/widgets/type_widgets/file/MediaPlayer.tsx:159` | `player-pause` | exact |  |
| `bx-question-mark` | 1 | `packages/commons/src/lib/task_states.ts:61` | `question-mark` | exact |  |
| `bx-repeat` | 1 | `apps/client/src/widgets/type_widgets/file/media_play_mode.ts:24` | `repeat` | exact |  |
| `bx-reply` | 1 | `apps/client/src/widgets/sidebar/AttributeList.tsx:907` | `corner-up-left` | close |  |
| `bx-repost` | 1 | `apps/client/src/widgets/type_widgets/mind_map/NodePanel.tsx:510` | `replace` | close | mind map change image |
| `bx-restaurant` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:53` | `tools-kitchen-2` | exact |  |
| `bx-right-indent` | 1 | `apps/client/src/widgets/layout/StatusBar.tsx:534` | `indent-increase` | exact |  |
| `bx-rotate-180` | 1 | `apps/client/src/widgets/FloatingButtonsDefinitions.tsx:177` | — | utility | CSS rotation modifier |
| `bx-rotate-270` | 1 | `apps/client/src/widgets/collections/table/context_menu.ts:208` | — | utility | CSS rotation modifier |
| `bx-rotate-right` | 1 | `apps/client/src/widgets/type_widgets/file/Video.tsx:268` | `rotate-clockwise` | exact |  |
| `bx-select-multiple` | 1 | `packages/trilium-core/src/services/keyboard_actions.ts:249` | `select-all` | close |  |
| `bx-slideshow` | 1 | `packages/trilium-core/src/services/hidden_subtree_templates.ts:334` | `presentation` | exact |  |
| `bx-smile` | 1 | `apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:233` | `mood-smile` | exact |  |
| `bx-sort` | 1 | `apps/client/src/widgets/type_widgets/options/active_content.tsx:538` | `arrows-sort` | close |  |
| `bx-store` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:154` | `building-store` | exact |  |
| `bx-swim` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:96` | `swimming` | exact |  |
| `bx-sync` | 1 | `apps/client/src/widgets/type_widgets/llm_chat/ToolCallCard.tsx:58` | `refresh` | close |  |
| `bx-target-lock` | 1 | `apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:232` | `target` | exact |  |
| `bx-task` | 1 | `apps/client/src/widgets/type_widgets/text/ai_assistant_stream.ts:242` | `clipboard-check` | close |  |
| `bx-task-x` | 1 | `apps/client/src/widgets/collections/board/context_menu.ts:562` | `clipboard-x` | close |  |
| `bx-test-tube` | 1 | `apps/client/src/widgets/buttons/global_menu.tsx:116` | `test-pipe` | exact |  |
| `bx-toggle-left` | 1 | `apps/client/src/widgets/attribute_widgets/attribute_types.ts:17` | `toggle-left` | exact |  |
| `bx-transfer-alt` | 1 | `apps/client/src/widgets/type_widgets/mind_map/context_menu.ts:46` | `arrows-left-right` | exact |  |
| `bx-trending-up` | 1 | `apps/client/src/widgets/ribbon/NotePathsTab.tsx:107` | `trending-up` | exact |  |
| `bx-underline` | 1 | `apps/client/src/widgets/type_widgets/options/highlights_list_options.tsx:40` | `underline` | exact |  |
| `bx-upload` | 1 | `apps/client/src/widgets/type_widgets/Attachment.tsx:470` | `upload` | exact |  |
| `bx-user` | 1 | `apps/client/src/widgets/type_widgets/text/ai_quick_actions.ts:68` | `user` | exact |  |
| `bx-vertical-bottom` | 1 | `apps/client/src/widgets/collections/board/context_menu.ts:294` | `arrow-bar-to-down` | exact |  |
| `bx-vertical-center` | 1 | `apps/client/src/stylesheets/style.css:3441` | `fold` | close | codepoint in style.css |
| `bx-video` | 1 | `packages/commons/src/lib/notes.ts:189` | `video` | exact |  |
| `bx-video-off` | 1 | `apps/client/src/widgets/type_widgets/file/Video.tsx:75` | `video-off` | exact |  |
| `bx-volume-full` | 1 | `apps/client/src/widgets/type_widgets/file/MediaPlayer.tsx:212` | `volume` | exact |  |
| `bx-volume-low` | 1 | `apps/client/src/widgets/type_widgets/file/MediaPlayer.tsx:212` | `volume-2` | exact |  |
| `bx-zoom-in` | 1 | `packages/trilium-core/src/services/keyboard_actions.ts:857` | `zoom-in` | exact |  |
| `bx-zoom-out` | 1 | `packages/trilium-core/src/services/keyboard_actions.ts:849` | `zoom-out` | exact |  |
| `bxl-apple` | 1 | `apps/client/src/widgets/type_widgets/options/components/PlatformIndicator.tsx:29` | `brand-apple` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-baidu` | 1 | `apps/client/src/widgets/type_widgets/options/desktop.tsx:126` | `brand-baidu` | close | brand logo; existence in Tabler least certain of the brand set |
| `bxl-bing` | 1 | `apps/client/src/widgets/type_widgets/options/desktop.tsx:125` | `brand-bing` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-c-plus-plus` | 1 | `packages/commons/src/lib/mime_type.ts:57` | `brand-cpp` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-django` | 1 | `packages/commons/src/lib/mime_type.ts:73` | `brand-django` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-docker` | 1 | `packages/commons/src/lib/mime_type.ts:74` | `brand-docker` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-github` | 1 | `apps/client/src/widgets/dialogs/about.tsx:133` | `brand-github` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-go-lang` | 1 | `packages/commons/src/lib/mime_type.ts:96` | `brand-golang` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-google` | 1 | `apps/client/src/widgets/type_widgets/options/desktop.tsx:127` | `brand-google` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-less` | 1 | `packages/commons/src/lib/mime_type.ts:119` | `file-type-css` | none | no Less logo in Tabler; generic stylesheet fallback |
| `bxl-microsoft` | 1 | `apps/client/src/widgets/dialogs/import/onenote.tsx:265` | `brand-windows` | weak | no Microsoft corporate mark in Tabler; Windows logo as stand-in |
| `bxl-php` | 1 | `packages/commons/src/lib/mime_type.ts:147` | `brand-php` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-postgresql` | 1 | `packages/commons/src/lib/mime_type.ts:150` | `database` | none | no PostgreSQL logo in Tabler; generic database fallback |
| `bxl-python` | 1 | `packages/commons/src/lib/mime_type.ts:156` | `brand-python` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-react` | 1 | `apps/client/src/widgets/type_widgets/Render.tsx:126` | `brand-react` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-sass` | 1 | `packages/commons/src/lib/mime_type.ts:165` | `brand-sass` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-typescript` | 1 | `packages/commons/src/lib/mime_type.ts:201` | `brand-typescript` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxl-windows` | 1 | `apps/client/src/widgets/type_widgets/options/components/PlatformIndicator.tsx:25` | `brand-windows` | close | brand logo; Tabler ships a brand-* outline rendition |
| `bxs-chevron-up` | 1 | `apps/client/src/widgets/find.ts:72` | `chevron-up` | close | solid source |
| `bxs-directions` | 1 | `apps/client/src/stylesheets/tree.css:181` | `direction-sign` | close | solid source; clone indicator (new layout) codepoint in tree.css |
| `bxs-down-arrow-alt` | 1 | `apps/client/src/widgets/buttons/global_menu.tsx:42` | `arrow-down` | close | solid source |
| `bxs-edit-alt` | 1 | `apps/client/src/widgets/collections/table/context_menu.ts:112` | `pencil` | close | solid source |
| `bxs-error` | 1 | `apps/client/src/widgets/layout/NoteBadges.tsx:190` | `alert-triangle` | close | solid source |
| `bxs-file-gif` | 1 | `packages/commons/src/lib/notes.ts:95` | `gif` | close | solid source |
| `bxs-flag-checkered` | 1 | `apps/client/src/widgets/collections/geomap/GpxTrack.tsx:48` | `flag-3` | weak | no checkered flag glyph known (GPX track end marker) |
| `bxs-layer-minus` | 1 | `packages/trilium-core/src/services/keyboard_actions.ts:102` | `stack-pop` | close | solid source |
| `bxs-parking` | 1 | `apps/client/src/widgets/collections/geomap/osm_icons.ts:74` | `parking` | close | solid source |
| `bxs-pencil` | 1 | `apps/client/src/widgets/dialogs/help.tsx:19` | `pencil` | close | solid source |
| `bxs-pin` | 1 | `apps/client/src/widgets/collections/calendar/index.tsx:454` | `pinned` | close | solid source |
| `bxs-quote-alt-left` | 1 | `apps/client/src/widgets/type_widgets/llm_chat/chat_context_menu.ts:125` | `quote` | close | solid source |
| `bxs-right-arrow` | 1 | `apps/client/src/widgets/ribbon/NotePathsTab.css:34` | `caret-right` | close | solid triangle; codepoint in NotePathsTab.css |
| `bxs-star` | 1 | `apps/client/src/widgets/launch_bar/SyncStatus.tsx:89` | `star` | close | solid source; Tabler has a filled star variant |
| `bxs-terminal` | 1 | `packages/commons/src/lib/mime_type.ts:151` | `terminal-2` | close | solid source |
| `bxs-tree` | 1 | `apps/client/src/widgets/note_tree.ts:122` | `tree` | close | solid source |

## 4. Totals

| grade | distinct names | occurrences |
|---|---:|---:|
| exact | 236 | 1267 |
| close | 143 | 396 |
| weak | 8 | 15 |
| none | 3 | 4 |
| utility | 8 | 68 |
| **total** | **398** | **1750** |

Verified against the class list of `@tabler/icons-webfont` 3.46.0: all 390 Tabler names.

### `none` icons
- `bxl-java` (2) — no Java logo in Tabler; generic code-file fallback
- `bxl-less` (1) — no Less logo in Tabler; generic stylesheet fallback
- `bxl-postgresql` (1) — no PostgreSQL logo in Tabler; generic database fallback

### `weak` icons
- `bx-outline` → `copy` (6) — all 6 uses are Duplicate actions (tree, breadcrumb, board, launcher, template, keyboard action); Tabler has no matching outline glyph, so map by meaning
- `bxs-tag-x` → `backspace` (3) — clears the autocomplete field; tag-off is the glyph-level match
- `bx-alert` → `alert-triangle` (1) — NOT a Boxicons 2 name: the critical-error toast (desktop.ts:38) renders no icon today
- `bx-calendar-edit` → `calendar-cog` (1) — no calendar-with-pencil glyph known; compose or pick per call site
- `bx-collapse-horizontal` → `arrow-autofit-width` (1) — no horizontal fold glyph; fold rotated 90deg is the alternative
- `bx-hdd` → `server-2` (1) — no hard-disk glyph known (backup options note)
- `bxl-microsoft` → `brand-windows` (1) — no Microsoft corporate mark in Tabler; Windows logo as stand-in
- `bxs-flag-checkered` → `flag-3` (1) — no checkered flag glyph known (GPX track end marker)
