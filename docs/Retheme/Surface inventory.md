# Phase 0: client surface inventory (Trilium v0.105.0)

Read-only audit of `apps/client`. Paths are relative to `apps/client/src/` unless they start with
`apps/`, `packages/` or `index.html`.

Stylesheet shorthand:

| Short | Path |
|---|---|
| `style.css` | `stylesheets/style.css` (3461 lines, always loaded) |
| `tree.css`, `table.css`, `ckeditor-theme.css` | `stylesheets/…` |
| `theme-light.css` | `stylesheets/theme-light.css` (always loaded as the base, 61 tokens) |
| `tn/base.css` | `stylesheets/theme-next/base.css` (imports all `tn/*` files below) |
| `tn/shell.css`, `tn/dialogs.css`, `tn/forms.css`, `tn/pages.css`, `tn/ribbon.css` | `stylesheets/theme-next/…` |
| `tn/text.css`, `tn/canvas.css`, `tn/table.css` | `stylesheets/theme-next/notes/…` |
| `tn-light/dark` | `stylesheets/theme-next-light.css` / `theme-next-dark.css` (344 tokens each, plus a few `.with-hue` rules) |

Load order (`index.ts` `loadStylesheets()`): Bootstrap CSS → `ckeditor-theme.css` → `theme-light.css` →
theme (`services/theme.ts`; default `next` = `theme-next-light.css` + `theme-next-dark.css` under
`prefers-color-scheme: dark`) → `style.css`. Component `.css` files come in through Vite imports. The login,
setup and set-password pages go through the same `index.ts` path, so they get the theme too. The print page
(`device=print`) skips the theme.

Columns: **Owner** is who produces the markup. **Impl** is `jq` (legacy jQuery `BasicWidget` family) or
`preact`. **tn** says whether `theme-next/*` or `theme-next-{light,dark}.css` has rules aimed at the surface.
**Freq** is a guess at how often it is used.

---

## 1. title-bar / tab-bar

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| T1 | Tab bar: note tabs, close button, new-tab button, drag reorder | native | jq · `widgets/tab_row.ts` | 276-line inline `<style>` in `tab_row.ts`; `style.css` (`.tab-row-widget`, WCO padding); `tn/shell.css` (`.tab-row-widget .note-tab…`, `.note-new-tab`, about 300 lines) | yes | high | Desktop only. Dragging uses `draggabilly` (behaviour only). Sits in `#rest-pane`, or full width above the launcher when the launcher is horizontal or the window controls are on the left |
| T2 | Tab row container and window-controls spacer (Electron title bar overlay, custom title-bar buttons) | native | jq · `FlexContainer .tab-row-container` in `layouts/desktop_layout.tsx` | `style.css` (`#tab-row-left-spacer`, `.custom-title-bar-button`, WCO rules); `tn/shell.css` (`.tab-row-container`, background-effects variants) | yes | high | Height (40px) and background are set inline in the layout |
| T3 | Tab history back/forward buttons | native | preact · `widgets/TabHistoryNavigationButtons.tsx` | `TabHistoryNavigationButtons.css`; `tn/shell.css` (`.tab-history-navigation-buttons`) | yes | medium | |
| T4 | Left pane toggle | native | preact · `widgets/buttons/left_pane_toggle.tsx` | `left_pane_toggle.css`; `style.css` and `tn/shell.css` (`.tab-row-container .toggle-button`) | yes | medium | In the tab row for horizontal layout, at the bottom of the launcher rail for vertical |
| T5 | Right pane toggle | native | preact · `widgets/buttons/right_pane_toggle.tsx` | `style.css` and `tn/shell.css` (`.tab-row-container .toggle-button`) | yes | medium | **New layout only** |

## 2. launcher

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| L1 | Launcher bar (vertical rail or horizontal strip) | native | preact · `widgets/launch_bar/LauncherContainer.tsx` inside the jq `#launcher-pane` built by `desktop_layout.tsx#buildLauncherPane` | `style.css` (`#launcher-pane .launcher-button`); `tn/shell.css` LAUNCHER PANE section (about 220 lines, 17 `--launcher-pane-*` tokens) | yes | high | Width/height (53px) set inline. On mobile it is the bottom bar (see MO1) |
| L2 | Launcher buttons: command, note and script launchers, Today in journal, spacer | native | preact · `launch_bar/launch_bar_widgets.tsx`, `GenericButtons.tsx`, `SpacerWidget.tsx` | `style.css`; `tn/shell.css` | yes | high | Right-click menu comes from `menus/launcher_button_context_menu.ts` |
| L3 | Global menu (main menu dropdown) | native | preact · `widgets/buttons/global_menu.tsx` (Bootstrap-backed `react/Dropdown`) | `global_menu.css` (113); `tn/shell.css` (`#launcher-pane .global-menu`); `tn/base.css` MENUS | yes | medium | Also holds the update badge, zoom controls and layout switches |
| L4 | Calendar launcher dropdown | native | preact · `launch_bar/CalendarWidget.tsx`, `Calendar.tsx` | `CalendarWidget.css` (191); `tn/shell.css` (`.calendar-dropdown-widget`, about 100 lines) | yes | medium | Trilium's own calendar, not fullcalendar |
| L5 | Bookmarks launcher and bookmark-folder dropdown | native | preact · `launch_bar/BookmarkButtons.tsx` | `BookmarkButtons.css`; `tn/shell.css` (`div.bookmark-folder-widget`) | yes | medium | |
| L6 | History back/forward launchers (long-press history list) | native | preact · `launch_bar/HistoryNavigation.tsx` | `style.css`/`tn/shell.css` launcher-button rules; the list renders as a context menu (P1) | yes | medium | |
| L7 | Status indicators: sync status, protected-session shield | native | preact · `launch_bar/SyncStatus.tsx`, `ProtectedSessionStatusWidget.tsx` | `SyncStatus.css`; `tn/shell.css` (`.sync-status*`, `button.bx-check-shield`) | yes | low | Sync status only matters when sync is configured |
| L8 | Color scheme switcher | native | preact · `launch_bar/ColorSchemeSwitcher.tsx` | `ColorSchemeSwitcher.css` | no | low | Inherits the launcher-button rules |
| L9 | Quick search in the launcher (horizontal layout) | native | jq · `widgets/quick_search.ts`, wrapped by `launch_bar/LauncherDefinitions.tsx` | inline `<style>` in `quick_search.ts`; `style.css` (`#launcher-pane.horizontal .quick-search`); `tn/shell.css` (`div.quick-search`) | yes | medium | Horizontal layout only; vertical puts it in the left pane (LP2) |
| L10 | Sidebar-chat launcher and custom-widget launchers (user scripts) | native | preact · `launch_bar/SidebarChatButton.tsx`; jq or preact user widgets through `LauncherDefinitions.tsx` | none of their own | no | low | Chat needs AI enabled; custom widgets are skipped in safe mode |

## 3. left-pane

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| LP1 | Left pane container | native | jq · `widgets/containers/left_pane_container.ts` (visibility and width in `services/resizer.ts`) | `style.css` (`#left-pane`); `tn/shell.css` (13 `--left-pane-*` tokens, background-effects rules) | yes | high | Desktop only; its gutter is C2 |
| LP2 | Quick search box and results dropdown | native | jq · `widgets/quick_search.ts` (Bootstrap dropdown) | inline `<style>` (133 lines); `style.css`; `tn/shell.css` (`div.quick-search`, about 150 lines) | yes | high | Vertical layout |
| LP3 | Note tree rows: node, expander, icon, title, active/selected/hover states | vendored:jquery.fancytree | jq · `widgets/note_tree.ts` | `tree.css` (327); `note_tree.css`; inline `<style>` (72); `theme-light.css` (`.fancytree-node.tinted`); `tn/shell.css` (`:is(#left-pane,.tree-popup-sidebar) span.fancytree-node…`, about 200 lines) | yes | high | The same tree also renders inside the Tree popup editor (M20) |
| LP4 | Tree row decorations: hover add-note and unhoist buttons, clone and shared indicators | native | jq · `widgets/note_tree.ts` (injected into fancytree nodes) | `tree.css` (`.tree-item-button`, `.note-indicator-icon`); `tn/shell.css` | yes | high | |
| LP5 | Tree drag-and-drop marker and drop targets | vendored:jquery.fancytree | jq · `widgets/note_tree.ts` (dnd5 extension) | `tree.css` (`#fancytree-drop-marker`, `.fancytree-drop-accept`) | no | medium | |
| LP6 | Tree actions toolbar and tree settings popup | native | jq · `widgets/note_tree.ts` (template) | inline `<style>`; `tn/shell.css` (`.tree-actions`, `.tree-settings-popup`) | yes | medium | |

## 4. center-pane (chrome around the note content)

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| C1 | Split note container (side-by-side notes, active split outline) | native | jq · `widgets/containers/split_note_container.ts`, `note_wrapper.ts` | `style.css` (`.note-split`); `tn/shell.css` CENTER PANE (background, first-split radius, active border) | yes | high | |
| C2 | Pane gutters: left↔rest, center↔right, between splits, split editors | vendored:split.js | `services/resizer.ts` (`@triliumnext/split.js` on `#left-pane/#rest-pane`, `#center-pane/#right-pane`, `.note-split`); `sidebar/RightPanelContainer.tsx`; `type_widgets/helpers/SplitEditor.tsx` | `style.css` (`.gutter*`); `tn/shell.css` (`.gutter`, `--gutter-color`, `--gutter-hover-color`); `sidebar/RightPanelContainer.css`; `helpers/SplitEditor.css` | yes | medium | theme-next changes only the color and hover transition |
| C3 | Title row: note icon button and icon picker | native | preact · `widgets/note_icon.tsx`, `react/IconPicker.tsx` (react-window) | `note_icon.css` (119); `IconPicker.css`; `tn/shell.css` (`.note-icon-widget`) | yes | high | |
| C4 | Title row: note title input | native | preact · `widgets/note_title.tsx` | `note_title.css` (141); `style.css` (`.title-row`); `tn/shell.css` (`.note-title-widget input`, `.title-row`) | yes | high | |
| C5 | Split pane buttons: move left/right, close, new split | native | preact · `buttons/move_pane_button.tsx`, `close_pane_button.tsx`, `create_pane_button.tsx` | `style.css` (`.icon-action`); `tn/forms.css` (`.tn-tool-button`) | partial | medium | Title row in the **old layout**; the new layout moves them into the Note actions menu (C7) |
| C6 | Note badges: read-only, shared, active content, snippet, save status, office preview | native | preact · `widgets/layout/NoteBadges.tsx`, `ActiveContentBadges.tsx`, `SnippetBadge.tsx`, `react/Badge.tsx` | `NoteBadges.css` (66); `react/Badge.css`; `tn/base.css` (`:root .badge`) | partial | medium | **New layout only** (always present on mobile) |
| C7 | Note actions: the ⋯ note menu and custom action buttons | native | preact · `widgets/ribbon/NoteActions.tsx`, `NoteActionsCustom.tsx` | `NoteActions.css`; `NoteActionsCustom.css`; `tn/base.css` MENUS; `tn/shell.css` (`.note-actions`) | yes | high | Title row in the new layout (horizontal dots); in the ribbon in the old layout (vertical dots, plus a Revisions button) |
| C8 | Ribbon: tab strip and tab bodies | native | preact · `widgets/ribbon/Ribbon.tsx` (lazy), `RibbonDefinition.ts` | `Ribbon.css` (111); `tn/ribbon.css` (tab contents only); `tn/shell.css` (only `.ribbon-container{margin-bottom:0}`) | partial | high (old) | **Old layout only** |
| C9 | Formatting toolbar: classic CKEditor toolbar | vendored:ckeditor5 | preact · `ribbon/FormattingToolbar.tsx` (ribbon tab; `FixedFormattingToolbar` under the tab row) | `FormattingToolbar.css`; `style.css` "Fixed formatting toolbar"; `tn/shell.css` (`#rest-pane > .classic-toolbar-widget`, toolbar tokens); `tn/text.css` (`.ck.ck-toolbar`) | yes | high | Old layout: a ribbon tab. New layout: a fixed bar under the tab row |
| C10 | Basic properties: note type, protected, editable, bookmark, share, template, language | native | preact · `ribbon/BasicPropertiesTab.tsx` | `BasicPropertiesTab.css`; `tn/ribbon.css` (`ul.note-type-dropdown`, `.editability-dropdown`) | yes | high | New layout reuses the parts inside Note actions (C7) and the status bar (C23) |
| C11 | Owned attributes editor (inline attribute text box) | vendored:ckeditor5 | preact · `ribbon/OwnedAttributesTab.tsx` → `ribbon/components/AttributeEditor.tsx` | `AttributeEditor.css`; `AttributeHelp.css`; `tn/ribbon.css` (`.attribute-list`) | yes | high | New layout shows it in the status-bar Attributes pane (C25) |
| C12 | Inherited attributes | native | preact · `ribbon/InheritedAttributesTab.tsx` | `InheritedAttributesTab.css` | no | medium | |
| C13 | Info tabs: note paths, note info, similar notes, edited notes | native | preact · `ribbon/NotePathsTab.tsx`, `NoteInfoTab.tsx`, `SimilarNotesTab.tsx`, `EditedNotesTab.tsx` | `NotePathsTab.css`, `NoteInfoTab.css`, `SimilarNotesTab.css`; `tn/ribbon.css` (`.note-info-widget`, `.similar-notes-widget`, `.edited-notes-list`) | yes | medium | New layout reuses them in status-bar dropdowns and panes |
| C14 | File properties and image properties | native | preact · `ribbon/FilePropertiesTab.tsx`, `ImagePropertiesTab.tsx` | `FilePropertiesTab.css`; `tn/ribbon.css` (`.file-properties-widget`, `.image-properties`) | yes | medium | |
| C15 | Script executor, search definition, note properties (`pageUrl`) | native | preact · `ribbon/ScriptTab.tsx`, `SearchDefinitionTab.tsx` (+ `SearchDefinitionOptions.tsx`), `NotePropertiesTab.tsx` | `ScriptTab.css`; `SearchDefinitionTab.css` (186) | no | medium | New layout shows the search definition in Note title actions (C22) |
| C16 | Ribbon note map tab | vendored:force-graph | preact · `ribbon/NoteMapTab.tsx` → `note_map/NoteMap.tsx` | `NoteMapTab.css`; `note_map/NoteMap.css`; `tn/pages.css` (`.note-map-widget`) | partial | low | Canvas-rendered. The new layout opens the right-pane map instead (`components/root_command_executor.ts`) |
| C17 | Content-header info bars: read-only notice, shared-note notice | native | preact · `ReadOnlyNoteInfoBar.tsx`, `shared_info.tsx` (`react/InfoBar.tsx`) inside jq `containers/content_header.ts` | `ReadOnlyNoteInfoBar.css`; `shared_info.css`; `react/InfoBar.css` | no | medium | **Old layout only** |
| C18 | Promoted attributes form | native | preact · `widgets/PromotedAttributes.tsx` | `PromotedAttributes.css` (94); `tn/shell.css` (`div.promoted-attribute-cell`, about 120 lines); `tn/ribbon.css` | yes | medium | Old layout: above the content. New layout: inside Note title actions (C22) and the popup editor |
| C19 | Floating buttons (edit, TOC, highlights, run, export, help, split orientation…) | native | preact · `widgets/FloatingButtons.tsx`, `FloatingButtonsDefinitions.tsx` | `FloatingButtons.css` (160); `style.css`; `tn/shell.css` (`.floating-buttons-children`, about 200 lines) | yes | high | **Old layout only** (also in the popup editor) |
| C20 | Backlinks ticker and list | native | preact · `FloatingButtonsDefinitions.tsx` (`BacklinksWidget`) | `widgets/Backlinks.css`; `tn/shell.css` (`.backlinks-widget`) | yes | medium | Old layout: a floating button. New layout: a status-bar badge |
| C21 | Inline title (large title with created/modified details) | native | preact · `widgets/layout/InlineTitle.tsx` | `InlineTitle.css` (97) | no | high | **New layout only** |
| C22 | Note title actions: type switcher for new notes, promoted attributes, search definition, edited notes | native | preact · `widgets/layout/NoteTitleActions.tsx`, `NoteTypeSwitcher.tsx`, `NoteContentSwitcher.tsx` | `NoteTitleActions.css`; `NoteTypeSwitcher.css`; `NoteContentSwitcher.css` | no | medium | **New layout only** |
| C23 | Status bar: language, note paths, backlinks, note info, attachment count, code tab width and MIME switchers | native | preact · `widgets/layout/StatusBar.tsx` (Bootstrap dropdowns) | `StatusBar.css` (220); `tn/shell.css` (a single `.status-bar-panel-open` rule; `--status-bar-border-color`) | partial | high | **New layout only** |
| C24 | Breadcrumb | native | preact · `widgets/layout/Breadcrumb.tsx` | `Breadcrumb.css` (115) | no | high | **New layout only**; mounted in the status bar |
| C25 | Status-bar bottom panels: Attributes pane, Similar notes pane | native | preact · `StatusBar.tsx` (`AttributesPane`, `SimilarNotesPane`, `BottomPanel`) | `StatusBar.css`; `AttributeEditor.css` | no | medium | **New layout only**; the Attributes pane hosts the CKEditor attribute editor |
| C26 | Watched-file update notice ("file changed on disk") | native | jq · `widgets/watched_file_update_status.ts` | inline `<style>` | no | low | Electron only |
| C27 | Find/replace bar (in-note find) | native | jq · `widgets/find.ts` (+ `find_in_text.ts`, `find_in_code.ts`, `find_in_html.ts`; `mark.js` highlights) | inline `<style>` (38); `tn/shell.css` (`.find-replace-widget`) | yes | medium | |
| C28 | API log panel (render/script errors) | native | preact · `widgets/api_log.tsx` | `api_log.css` | no | low | |
| C29 | Note list host and collection toolbar: properties bar, pagination, sort, filter | native | preact · `widgets/collections/NoteList.tsx`, `note_bars/CollectionProperties.tsx`, `collections/Pagination.tsx`, `SortDropdown.tsx`, `collection_filter.tsx` | `NoteList.css`; `CollectionProperties.css`; `Pagination.css`; `SortDropdown.css`; `collection_filter.css`; `tn/text.css` (`.note-list-widget`) | partial | high | |
| C30 | Search results list (search notes) | native | preact · `widgets/search_result.tsx` → `collections/search/SearchResultsList.tsx` | `search_result.css`; `SearchResultsList.css`; `tn/pages.css` (`.search-result-widget-content`) | yes | medium | |
| C31 | Zen mode and its close button | native | preact · `widgets/close_zen_button.tsx` | `close_zen_button.css`; `style.css` (`body.zen …`, about 240 lines, separate old/new layout branches) | no | low | |

## 5. note-detail-pane: note type widgets (`widgets/note_types.tsx` `TYPE_MAPPINGS`)

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| N1 | Text note editor (editable) | vendored:ckeditor5 | preact · `type_widgets/text/EditableText.tsx`, `CKEditorWithWatchdog.tsx`, `react/CKEditor.tsx` | `EditableText.css`; `packages/ckeditor5/src/theme/*.css` (`ck-content.css` and others); `ckeditor-theme.css`; `style.css` (`.ck-content`, footnotes, to-do states, collapsibles); `tn/text.css` (885 lines) | yes | high | The most-used surface. Floating editor UI is P9 |
| N2 | Read-only text view | native | preact · `type_widgets/text/ReadOnlyText.tsx` | `ReadOnlyText.css`; `ck-content.css`; `style.css`; `tn/text.css` | yes | high | Displays CKEditor HTML; KaTeX, Mermaid and highlight.js output render inside |
| N3 | Include-note embeds and reference links inside text | native | `services/content_renderer.ts`, `services/link.ts` | `style.css` (`.include-note*`, about 180 lines); `tn/text.css` (`a.reference-link`) | yes | high | Inside editable and read-only text |
| N4 | Syntax-highlighted code blocks | vendored:highlight.js | `services/syntax_highlight.ts` (`@triliumnext/highlightjs` `loadTheme`) | the highlight.js theme picked in settings; `tn/text.css` (one `.hljs` rule) | partial | high | Colors come from a separate theme option, not the app theme |
| N5 | Math rendering | vendored:katex | `services/math.ts` | `services/katex.scss` | no | medium | Used in text, TOC, tooltips and chat |
| N6 | Code note editor (editable and read-only) | vendored:codemirror | preact · `type_widgets/code/Code.tsx`, `CodeMirror.tsx` (`@triliumnext/codemirror`) | `code.css`; `style.css` (`.cm-editor`, `.cm-scroller`); color themes in `packages/codemirror/src/color_themes.ts` | no | high | Colors come from a separate CodeMirror theme option |
| N7 | Mermaid diagram note (source / split / preview) | vendored:mermaid | preact · `type_widgets/mermaid/Mermaid.tsx`, `helpers/SvgSplitEditor.tsx` (svg-pan-zoom), `helpers/SplitEditor.tsx` | `SplitEditor.css`; `tn/text.css` (`.ck-mermaid__editing-view`, embedded diagrams only) | partial | medium | SVG output; the source pane is CodeMirror |
| N8 | Markdown note (source + preview) | vendored:codemirror | preact · `type_widgets/markdown/Markdown.tsx` | `Markdown.css`; `MarkdownCommons.css`; `SplitEditor.css` | no | medium | The preview pane is native |
| N9 | Canvas note | vendored:@excalidraw/excalidraw | preact · `type_widgets/canvas/Canvas.tsx` | `@excalidraw/excalidraw/index.css`; `Canvas.css`; `NoteEmbeddable.css`; `tn/canvas.css` (260); `tn/base.css` (`.excalidraw .context-menu`); `tn/shell.css` (`.excalidraw`); `tn-dark` (`.excalidraw.theme--dark`) | yes | medium | Drawing is canvas-rendered; toolbars and menus are DOM |
| N10 | Mind map note: map, toolbar, node panel, memo, context menu | vendored:mind-elixir | preact · `type_widgets/mind_map/MindMap.tsx`, `MapToolbar.tsx`, `NodePanel.tsx`, `NodeMemo.tsx`, `MapContextMenu.tsx` | `MindMap.css`; `MapToolbar.css`; `NodePanel.css`; `NodeMemo.css`; `MapContextMenu.css` | no | medium | Nodes are DOM, links are SVG. Toolbar, panel and menu are Trilium's |
| N11 | Relation map note | vendored:jsplumb | preact · `type_widgets/relation_map/RelationMap.tsx`, `jsplumb.tsx`, `NoteBox.tsx`, `MapToolbar.tsx` (panzoom) | `RelationMap.css`; `MapToolbar.css`; `tn/shell.css` (`.relation-map-buttons`) | partial | low | |
| N12 | Note map note (link graph and tree map) | vendored:force-graph | preact · `type_widgets/NoteMap.tsx` → `note_map/NoteMap.tsx`, `MapTypeSwitcher.tsx` | `type_widgets/NoteMap.css`; `note_map/NoteMap.css`; `tn/pages.css` (`.fixnodes-type-switcher`) | partial | medium | Canvas; `note_map/rendering.ts` reads colors from CSS variables |
| N13 | Spreadsheet note | vendored:@univerjs | preact · `type_widgets/spreadsheet/Spreadsheet.tsx` | nine `@univerjs/preset-sheets-*/lib/index.css`; `Spreadsheet.css` | no | low | Canvas grid with Univer DOM chrome; its own dark-mode handling |
| N14 | PDF viewer (PDF file note) | vendored:pdf.js | preact · `type_widgets/file/Pdf.tsx`, `PdfViewer.tsx` (iframe `pdfjs/web/viewer.html` from `packages/pdfjs-viewer`) | styles injected into the iframe (`useStyleInjection`); `style.css` (iframe sizing) | no | medium | Iframe. The new layout hides pdf.js's sidebar (`sidebar=0`) in favour of R11 |
| N15 | Media file note: audio/video player, waveform seek bar, visualizer | native | preact · `type_widgets/File.tsx`, `file/Audio.tsx`, `Video.tsx`, `MediaPlayer.tsx`, `WaveformSeekBar.tsx`, `AudioVisualizer.tsx` | `File.css`; `MediaPlayer.css`; `Video.css`; `WaveformSeekBar.css`; `AudioVisualizer.css`; `MediaProxy.css` | no | low | |
| N16 | Other file previews: Office, font, GPX, text, download card | native | preact · `file/Office.tsx`, `FontPreview.tsx`, `GpxPreview.tsx`, `File.tsx` | `FontPreview.css`; `GpxPreview.css`; `File.css` | no | low | Office HTML comes from `services/office_renderer.ts` |
| N17 | Image note viewer | native | preact · `type_widgets/Image.tsx` → `react/ImageViewer.tsx` (react-zoom-pan-pinch), `react/SiblingNavigator.tsx` | `Image.css`; `ImageViewer.css`; `SiblingNavigator.css` | no | medium | |
| N18 | Attachment list and attachment detail | native | preact · `type_widgets/Attachment.tsx` | `Attachment.css`; `tn/pages.css` (`.attachment-list`); `style.css` (`.attachment-actions-toolbar`) | partial | medium | |
| N19 | Empty note / new-tab page (jump-to search, workspaces) | native | preact · `type_widgets/Empty.tsx` | `Empty.css`; `tn/base.css` (`.note-detail-empty .aa-*`); `tn/pages.css` (`.note-split.empty-note`) | yes | high | Suggestions come from autocomplete.js (P6) |
| N20 | Book note (collection host page) | native | preact · `type_widgets/Book.tsx` | `Book.css` | no | medium | Views are K1–K8 |
| N21 | Doc note (in-app help pages) | native | preact · `type_widgets/Doc.tsx` | `Doc.css`; `ck-content.css` | no | medium | |
| N22 | Web view note | native | preact · `type_widgets/WebView.tsx`, `helpers/SetupForm.tsx` | `WebView.css`; `SetupForm.css`; `style.css` (`footer.webview-footer`) | no | low | Electron `<webview>`, iframe elsewhere |
| N23 | Render note (script-rendered HTML/JSX and its setup form) | native | preact · `type_widgets/Render.tsx` | `Render.css`; `react/RenderErrorCard.css` | no | low | The content itself is user-authored |
| N24 | Protected-note password prompt (in the pane) | native | preact · `type_widgets/ProtectedSession.tsx` | `ProtectedSession.css`; `tn/forms.css` (`.tn-centered-form`) | yes | medium | |
| N25 | Blob stub (content not loaded) | native | preact · `type_widgets/BlobStub.tsx` | `BlobStub.css` | no | low | |
| N26 | SQL console: query editor and result grid | vendored:tabulator-tables | preact · `type_widgets/SqlConsole.tsx` (+ CodeMirror via `SplitEditor`) | `SqlConsole.css`; `table.css`; `style.css` (`#sql-console-query`); `tn/pages.css` (`.sql-table-schemas-widget`) | partial | low | |
| N27 | Backend log viewer | vendored:codemirror | preact · `type_widgets/code/BackendLog.tsx` via `ContentWidget.tsx` | `code.css`; `tn-light/dark` (`--log-*` tokens) | partial | low | |
| N28 | Space usage page: donut, treemap, browse, cleanup | native | preact · `type_widgets/space_usage/index.tsx`, `react/charts/Treemap.tsx` (d3-hierarchy layout), `DonutChart.tsx` | `space_usage/*.css`; `react/charts/*.css`; `tn-light/dark` (26 `--space-usage-*` tokens) | yes | low | SVG |
| N29 | Icon pack note (source + preview) | native | preact · `type_widgets/icon_pack/IconPack.tsx`, `IconPackPreview.tsx` | `IconPack.css`; `IconPackPreview.css`; `icon_pack_preview.css` | no | low | |
| N30 | AI chat note: message list, tool-call cards, input bar | native | preact · `type_widgets/llm_chat/LlmChat.tsx` (+ `ChatMessageList.tsx`, `ChatInputBar.tsx`, `ToolCallCard.tsx`) | `LlmChat.css`; `ChatMessage*.css`; `ChatInputBar.css`; `ToolCallCard.css`; `ExpandableCard.css`; `EditNoteContentDiff.css` | no | low | Only when AI is enabled (`aiEnabled`). The `style.css` "AI Chat Widget" rules are dead (see below) |
| N31 | Content-widget host for system pages | native | preact · `type_widgets/ContentWidget.tsx` | `ContentWidget.css`; `tn/pages.css` (`.note-detail-content-widget-content`) | yes | low | Hosts the settings panes (S1–S10), backend log and space usage |

## 6. note-detail-pane: collection views (`widgets/collections/NoteList.tsx` `ViewComponents`)

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| K1 | List view | native | preact · `collections/legacy/ListOrGridView.tsx` (`ListView`) | `ListOrGridView.css`; `tn-light/dark` (`.note-book-card`) | yes | high | Default for search notes |
| K2 | Grid view (cards) | native | preact · `collections/legacy/ListOrGridView.tsx` (`GridView`) | `ListOrGridView.css`; `tn-light/dark` (`.note-book-card.with-hue`, `.note-book-header.use-note-color`) | yes | high | Default for book notes |
| K3 | Table view | vendored:tabulator-tables | preact · `collections/table/index.tsx`, `tabulator.tsx`, `columns.tsx` | `tabulator-tables/dist/css/tabulator.css`; `table.css` (256); `table/index.css`; `columns.css`; `tn/table.css` (12 lines) | partial | medium | |
| K4 | Board (kanban) view | native | preact · `collections/board/index.tsx`, `column.tsx`, `card.tsx`, `properties.tsx`, `column_limit.tsx` | `board/index.css`; `properties.css`; `column_limit.css`; `tn-light/dark` (`.board-column h3`, `--board-item-*`) | partial | medium | |
| K5 | Calendar view with event popover and recurrence editor | vendored:fullcalendar | preact · `collections/calendar/index.tsx`, `calendar.tsx`, `EventPopover.tsx`, `RecurrenceEditor.tsx`, `EventDatesEditor.tsx` | `fullcalendar/skeleton.css`; `fullcalendar/themes/forma/theme.css`; `calendar/index.css`; `palette.css`; `EventPopover.css`; `tn-light/dark` (`--calendar-coll-*`, `.calendar-event-popover.with-hue`) | partial | medium | Grid from fullcalendar; popovers are Trilium's (P10) |
| K6 | Geo map view: markers, draw/edit toolbars, detail pane, search box, place panel | vendored:maplibre-gl | preact · `collections/geomap/index.tsx`, `map.tsx`, `DrawShape.tsx` (terra-draw), `DetailPane.tsx`, `MapToolbar.tsx`, `SearchBox.tsx` | `maplibre-gl/dist/maplibre-gl.css`; `geomap/*.css`; `tn-light/dark` (`.geo-detail-pane.with-hue`) | partial | low | WebGL map with DOM overlays. **Leaflet is not used** |
| K7 | Presentation view | vendored:reveal.js | preact · `collections/presentation/index.tsx` | `reveal.js/reveal.css` (raw); `presentation/reveal-themes/*.scss`; `presentation/index.css`; `slidejs.css` | no | low | Styled by reveal themes, not the app theme |
| K8 | Dashboard view | vendored:gridstack | preact · `collections/dashboard/index.tsx` | `gridstack/dist/gridstack.min.css`; `dashboard/index.css` | no | low | |
| K9 | Print variants of list and table views | native | preact · `collections/legacy/ListPrintView.tsx`, `table/TablePrintView.tsx` | `print.css`; `TablePrintView.css` | no | low | Print pipeline only |

## 7. right-pane

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| R1 | Legacy right pane container (card stack) | native | jq · `widgets/containers/right_pane_container.ts` | `style.css` (`#right-pane .card*`); `tn/shell.css` RIGHT PANE (`#right-pane .card-header…`) | yes | medium | **Old layout only** |
| R2 | Legacy table of contents | native | jq · `widgets/toc.ts` (`RightPanelWidget`) | inline `<style>` (91); `tn/shell.css` (`#right-pane .toc li`) | yes | medium | **Old layout only** |
| R3 | Legacy highlights list | native | jq · `widgets/highlights_list.ts` | inline `<style>` (23); `tn/shell.css` (`#right-pane .highlights-list li`) | yes | low | **Old layout only** |
| R4 | Right panel container: docked/peek host, header row, collapsible widget sections | native | preact · `sidebar/RightPanelContainer.tsx`, `RightPanelWidget.tsx` | `RightPanelContainer.css` (343); `tn/shell.css` (only the `#right-pane` background and the status-bar border) | partial | high | **New layout only** |
| R5 | Right pane tab strip: Outline / Attributes / Connections / Chat / Widgets | native | preact · `sidebar/RightPaneTabs.tsx` → `react/TabStrip.tsx` | `react/TabStrip.css`; `RightPanelContainer.css` | no | high | **New layout only** |
| R6 | Right pane peek button | native | preact · `sidebar/RightPanePeekButton.tsx` | `RightPanePeekButton.css` | no | medium | **New layout only** |
| R7 | Outline: table of contents and highlights list | native | preact · `sidebar/TableOfContents.tsx`, `HighlightsList.tsx` | `TableOfContents.css` (87); `RightPanelContainer.css` | no | high | New layout. Text, doc, markdown, PDF and chat notes |
| R8 | Attributes tab: attribute list, creation editor, value editor, editor overlay | native | preact · `sidebar/AttributeList.tsx`, `AttributeCreationEditor.tsx`, `AttributeValueEditor.tsx`, `AttributeEditorOverlay.tsx` | `AttributeList.css` (257); `AttributeCreationEditor.css`; `AttributeValueEditor.css`; `AttributeEditorOverlay.css` | no | medium | New layout |
| R9 | Connections tab: note map, note paths, backlinks | native | preact · `sidebar/NoteMap.tsx` (`NoteMapGraph.tsx` → force-graph), `NotePaths.tsx`, `Backlinks.tsx` | `sidebar/NoteMap.css`; `NotePaths.css`; `widgets/Backlinks.css` | no | medium | New layout. The map inside is canvas |
| R10 | PDF outline: pages, attachments, layers, annotations | native | preact · `sidebar/pdf/PdfPages.tsx` (react-window), `PdfAttachments.tsx`, `PdfLayers.tsx`, `PdfAnnotations.tsx` | `sidebar/pdf/*.css` | no | low | New layout, PDF notes |
| R11 | Board columns outline and chat highlights outline | native | preact · `sidebar/BoardColumns.tsx`, `ChatHighlightsList.tsx` | `BoardColumns.css`; `ChatHighlightsList.css` | no | low | New layout |
| R12 | Sidebar chat | native | preact · `sidebar/SidebarChat.tsx` (lazy; reuses `llm_chat/*`) | `SidebarChat.css`; `llm_chat/*.css` | no | low | New layout, AI enabled |
| R13 | User script widgets (Widgets tab or legacy pane) and sidebar help | native | jq · `widgets/right_panel_widget.ts` through `useLegacyWidget`; preact `sidebar/SidebarHelp.tsx` | `SidebarHelp.css`; `tn/shell.css` (`#right-pane .card-header`) | partial | low | User-authored content |

## 8. modal-layer

All dialogs are Preact components on `widgets/react/Modal.tsx` (Bootstrap modal JS). The lazy set is mounted
by `layouts/layout_commons.tsx` `applyModals()`.

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| M0 | Modal chrome: backdrop, header, footer, close/help buttons, sidebar variant, wizard | native | preact · `widgets/react/Modal.tsx`, `WizardModal.tsx`, `master_detail.tsx` | Bootstrap CSS; `react/Modal.css`; `WizardModal.css`; `style.css` (`.modal-*`, `.modal-content-with-sidebar`); `tn/dialogs.css` (`.modal .modal-content/header/footer`, `div.tn-tool-dialog`) | yes | high | Restyling this reaches every row below |
| M1 | Jump to note and command palette | native | preact · `dialogs/jump_to_note.tsx` | `jump_to_note.css` (100); `tn/dialogs.css` (`.jump-to-note-dialog`) | yes | high | Suggestions: P6 |
| M2 | Settings dialog: page sidebar, page body, mobile master-detail | native | preact · `dialogs/OptionsDialog.tsx` | `OptionsDialog.css` (188); `style.css` (`.modal-content-with-sidebar`); `tn/pages.css` (`.options-section*`) | yes | high | Settings open in a dialog, not a tab. Panes are S1–S10 |
| M3 | Recent changes and deleted notes | native | preact · `dialogs/recent_changes.tsx` | `tn/dialogs.css` (`.recent-changes-content`, about 150 lines); `style.css` | yes | medium | |
| M4 | Revisions with diff viewer | native | preact · `dialogs/revisions.tsx` (diff, htmldiff-js) | `revisions.css` (301); `style.css` (`.revision-diff-*`) | no | medium | |
| M5 | Keyboard cheatsheet / help | native | preact · `dialogs/help.tsx` | `tn/dialogs.css` (`.help-dialog`); `style.css` (`.help-cards`) | yes | low | |
| M6 | About | native | preact · `dialogs/about.tsx` | `about.css` (186) | no | low | |
| M7 | Small note-operation forms: add link, include note, note picker, item picker, clone to, move to, branch prefix, sort children, paste Markdown, upload attachments, content languages | native | preact · `dialogs/add_link.tsx`, `include_note.tsx`, `note_picker.tsx`, `item_picker.tsx`, `clone_to.tsx`, `move_to.tsx`, `branch_prefix.tsx`, `sort_child_notes.tsx`, `markdown_import.tsx`, `upload_attachments.tsx`, `content_languages.tsx` | `item_picker.css` (192); `branch_prefix.css`; otherwise M0 only | no | medium | Mostly generic forms |
| M8 | Note type chooser (new note / template) | native | preact · `dialogs/note_type_chooser.tsx` | `tn/dialogs.css` (`.note-type-chooser-dialog`) | yes | medium | |
| M9 | Delete notes confirmation | native | preact · `dialogs/delete_notes.tsx` (react-window) | `delete_notes.css`; `tn/dialogs.css` (`.delete-notes-list`) | yes | medium | |
| M10 | Import (files, Evernote, Notion, Obsidian, OneNote, Keep, Anytype) | native | preact · `dialogs/import/import_dialog.tsx` and provider files | `import_dialog.css` | no | low | |
| M11 | Export | native | preact · `dialogs/export.tsx` | `export.css` | no | low | |
| M12 | Protected session password | native | preact · `dialogs/protected_session_password.tsx` | M0 | no | medium | |
| M13 | Print preview | native | preact · `dialogs/print_preview.tsx` (iframe) | `print_preview.css`; `style.css` (`iframe.print-iframe`) | no | low | |
| M14 | Generic info / confirm / prompt | native | preact · `dialogs/info.tsx`, `confirm.tsx`, `prompt.tsx` (called through `services/dialog.ts`) | `info.css`; `confirm.css` | no | high | |
| M15 | Bulk actions | native | preact · `dialogs/bulk_actions.tsx`, `widgets/bulk_actions/**` | `bulk_actions.css` | no | low | |
| M16 | OCR text | native | preact · `dialogs/ocr_text.tsx` | `ocr_text.css`; `style.css` (`.ocr-*`) | no | low | |
| M17 | Note attributes dialog | native | preact · `dialogs/note_attributes.tsx` | `note_attributes.css` (173) | no | low | Hosts the CKEditor attribute editor |
| M18 | Incorrect CPU architecture warning | native | preact · `dialogs/incorrect_cpu_arch.tsx` | M0 | no | low | Electron |
| M19 | Popup editor (quick edit) | native | preact · `dialogs/PopupEditor.tsx` (eager, stays in the DOM) | `PopupEditor.css` (182); `tn-light/dark` (`.quick-edit-dialog-wrapper.with-hue`) | partial | medium | Old layout also shows `ReadOnlyNoteInfoBar` inside it |
| M20 | Tree popup editor | native | preact · `dialogs/TreePopupEditor.tsx` (embeds jq `NoteTreeWidget`) | `TreePopupEditor.css`; `tn/shell.css` (`.tree-popup-sidebar`) | yes | low | |
| M21 | Call-to-action prompts | native | preact · `dialogs/call_to_action.tsx` (eager) | M0 | no | low | Shows itself at startup |
| M22 | Password not set | native | preact · `dialogs/password_not_set.tsx` | M0 | no | low | Desktop layout only |
| M23 | Image compression | native | preact · `dialogs/image_compression/image_compression_dialog.tsx` | `image_compression_*.css` | no | low | |
| M24 | Modals owned by other widgets: note type options, TOTP/backup/password/fonts (settings), add AI provider, space-usage cleanup, board column limit and properties | native | preact · `ribbon/BasicPropertiesTab.tsx`, `options/totp.tsx`, `options/backup.tsx`, `options/password.tsx`, `options/appearance_fonts.tsx`, `options/llm/AddProviderModal.tsx`, `space_usage/cleanup_dialog.tsx`, `collections/board/properties.tsx`, `column_limit.tsx` | `AddProviderModal.css`; `cleanup_dialog.css`; `board/properties.css`; `column_limit.css` | no | low | |

### Settings panes (rendered inside M2 through `type_widgets/ContentWidget.tsx` `CONTENT_WIDGETS`)

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| S1 | Settings: Appearance (theme, old/new layout, fonts, zoom, background effects) | native | preact · `options/appearance.tsx`, `appearance_fonts.tsx` | `appearance.css`; `appearance_fonts.css`; `tn/pages.css` | yes | medium | Holds the layout switch |
| S2 | Settings: Shortcuts | native | preact · `options/shortcuts.tsx` | `shortcuts.css`; `tn/pages.css` (`:has(.shortcuts-options-section)`) | yes | low | |
| S3 | Settings: Text notes and Code notes | native | preact · `options/text_notes.tsx`, `highlights_list_options.tsx`, `code_notes.tsx`, `code_mime_types_list.tsx` | `text_notes.css`; `code_notes.css`; `code_mime_types_list.css` | yes | low | TOC and highlights visibility cards appear only in the old layout |
| S4 | Settings: Content manager, Media, Spellcheck | native | preact · `options/active_content.tsx`, `media.tsx`, `spellcheck.tsx` | `active_content.css`; `media.css` | yes | low | Spellcheck is Electron only |
| S5 | Settings: Password, Security (MFA/TOTP, OAuth), ETAPI | native | preact · `options/password.tsx`, `security.tsx`, `totp.tsx` (qrcode-generator), `etapi.tsx` | `password.css`; `totp.css`; `etapi.css`; `components/MfaStatusBadge.css` | yes | low | |
| S6 | Settings: Backup and Database | native | preact · `options/backup.tsx`, `database.tsx` | `backup.css`; `database.css`; `components/DatabaseFileList.css` | yes | low | |
| S7 | Settings: Sync | native | preact · `options/sync.tsx` | `tn/pages.css` | yes | low | |
| S8 | Settings: Desktop, Other, Localization, Advanced | native | preact · `options/desktop.tsx`, `other.tsx`, `i18n.tsx`, `advanced.tsx` | `desktop.css`; `other.css`; `i18n.css` | yes | low | Desktop is Electron only |
| S9 | Settings: AI / LLM | native | preact · `options/llm.tsx`, `llm/ModelSelection.tsx` | `llm.css`; `ModelSelection.css` | yes | low | |
| S10 | Settings chrome: page header, sections, rows, navigation, search results page, illustrated radios, platform badges | native | preact · `options/search_page.tsx`, `options/components/*` | `search_page.css`; `components/*.css`; `tn/pages.css` (`.options-section*`, `.options-section-card`) | yes | medium | Shared by all panes |

## 9. popup-layer (menus, tooltips, toasts, popovers)

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| P1 | Context menus: tree, note, link, launcher, image, text editor; board/table/calendar/geo map/space usage/chat items | native | jq · `menus/context_menu.ts` (renders into `#context-menu-container` in `apps/client/index.html`) | `style.css` (`#context-menu-container`, `.dropdown-submenu`, `.tn-menu-*`); `tn/base.css` MENUS (`.dropdown-menu` radius, padding, backdrop blur, submenu arrows, shortcuts); `tn/shell.css` (one rule) | yes | high | Uses `.dropdown-menu` markup, so the Next menu styling applies. Mobile shows it as a bottom sheet (MO7) |
| P2 | Dropdown menus: Preact `Dropdown`, FormList items, submenus, portaled menus | native | preact · `widgets/react/Dropdown.tsx`, `FormList.tsx` (34 importers; Bootstrap Dropdown/Popper) | Bootstrap CSS; `style.css` (`.dropdown-*`, `.tn-dropdown-portal`); `tn/base.css` MENUS (`.tn-dropdown-menu`, `.tn-dropdown-list`) | yes | high | |
| P3 | Toasts | native | preact · `widgets/Toast.tsx` (`services/toast.tsx`) | `Toast.css` (154); `tn/base.css` TOASTS; `tn/dialogs.css` (toast close buttons); `--toast-*` tokens | yes | high | Always mounted |
| P4 | Note preview tooltips (hover over links) | vendored:bootstrap | jq · `services/note_tooltip.ts` (Bootstrap Tooltip with a Trilium template) | `style.css` (`.tooltip.note-tooltip`, `.note-tooltip-*`); `tn/base.css` (`.tooltip.note-tooltip`, `.note-tooltip-content`); `tn-light/dark` (`.note-tooltip.with-hue`) | yes | high | |
| P5 | Plain tooltips (button titles, keyboard hints) | vendored:bootstrap | preact · `widgets/react/hooks.tsx` (`useStaticTooltip`), `react/Dropdown.tsx`; jq `[data-bs-toggle=tooltip]` | `style.css` (`.tooltip`, `.bs-tooltip-*`); `tn/base.css` (`.tooltip-inner kbd`); `tn/shell.css` (`.tooltip .tooltip-inner`); `--tooltip-*` tokens | yes | high | |
| P6 | Note autocomplete suggestions | vendored:autocomplete.js | jq · `services/note_autocomplete.ts` (+ `react/NoteAutocomplete.tsx`; loaded in `desktop.ts`/`mobile.ts`) | `style.css` (`.algolia-autocomplete`, `.aa-dropdown-menu`, about 70 lines); `tn/base.css` (`.note-detail-empty .aa-*`) | partial | high | Used by jump-to, add link, the empty page, relation inputs and promoted attributes |
| P7 | Attribute name/value autocomplete | vendored:autocomplete.js | jq · `services/attribute_autocomplete.ts` | `attribute_widgets/attribute_name_suggestion.css`; `style.css` (`.aa-*`) | partial | medium | |
| P8 | Attribute detail popup (edit a label or relation) | native | jq · `widgets/attribute_widgets/attribute_detail.tsx` (`AttributeDetailWidget`, mounted by `ribbon/components/AttributeEditor.tsx`) | `attribute_detail.css` (136); `label_value_*.css`; `values_input.css`; `tn/ribbon.css` (`.attr-detail .note-path`) | partial | medium | In the new layout it is positioned above the attributes pane |
| P9 | CKEditor floating UI: balloon and block toolbars, dropdown panels, mentions, slash commands, link/math/emoji/template/find forms, CK dialogs and tooltips | vendored:ckeditor5 | `packages/ckeditor5` through `type_widgets/text/EditableText.tsx` | `ckeditor-theme.css` (`.ck-dialog`, nested menus); `style.css` (`.ck-mentions`, slash commands); `tn/text.css` (about 600 lines); `tn/forms.css` (AI assistant form) | yes | high | |
| P10 | Popovers: calendar event popover, ghost popover | native | preact · `widgets/react/Popover.tsx` (@popperjs/core), `collections/calendar/EventPopover.tsx`, `GhostPopover.tsx` | `react/Popover.css` (164); `EventPopover.css`; `GhostPopover.css`; `tn-light/dark` (`.calendar-event-popover.with-hue`) | partial | medium | |
| P11 | Shortcut hints panel (keyboard overlay) | native | preact · `widgets/shortcut_hints/shortcut_hints_panel.tsx` (portal) | `shortcut_hints_panel.css`; `shortcut_hints_kbd.css`; `shortcut_hint_button.css` | no | low | Always mounted |
| P12 | Help dropdown, contextual help, help tooltip button | native | preact · `react/HelpDropdown.tsx`, `ContextualHelp.tsx`, `HelpTooltipButton.tsx` | `HelpDropdown.css`; `ContextualHelp.css`; `HelpTooltipButton.css`; `style.css` (`.help-dropdown`) | no | low | |
| P13 | Chart tooltips | native | preact · `react/charts/chart_tooltip.tsx` | `chart_tooltip.css` | no | low | Space usage |

## 10. standalone-page

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| SP1 | Login page (password, OpenID Connect, TOTP) | native | preact · `login.tsx` (`react/SetupPage.tsx`, `CredentialsForm.tsx`) | `setup.css`; `login.css`; `tn/forms.css` | partial | medium | `tn/pages.css` `.login-page` rules match nothing (no component uses that class) |
| SP2 | Setup wizard: new document, existing document, sync from server | native | preact · `setup.tsx`, `setup_existing.tsx` (`react/SlidePages.tsx`) | `setup.css` (528); `setup_existing.css` | partial | low | Gets the theme's form styling |
| SP3 | Setup: restore, backup, unlock | native | preact · `setup_restore.tsx`, `setup_backup.tsx`, `setup_unlock.tsx` | `setup_restore.css`; `setup_backup.css`; `setup_unlock.css` | partial | low | |
| SP4 | Set password page | native | preact · `set_password.tsx` | `setup.css`; `set_password.css` | partial | low | |
| SP5 | Print page (print and PDF export render) | native | preact · `print.tsx` (separate Vite input) | `print.css` (364); `packages/ckeditor5/src/theme/ck-content.css` | no | low | `device=print` skips the theme stylesheets |

## 11. mobile-only (`layouts/mobile_layout.tsx`; mobile is always the new layout)

| # | Surface | Owner | Impl · entry | Primary stylesheet(s) | tn | Freq | Notes |
|---|---|---|---|---|---|---|---|
| MO1 | Mobile shell: bottom bar with launcher, phone and tablet layouts | native | jq · `#mobile-bottom-bar` and `ScreenContainer` in `layouts/mobile_layout.tsx`, `mobile_widgets/screen_container.ts`; preact `LauncherContainer` | `layouts/mobile_layout.css`; `style.css` "Mobile, phone mode" / "tablet mode" (about 300 lines); `tn/shell.css` (`body.mobile`) | partial | high | |
| MO2 | Mobile note navigator (replaces the fancytree tree) | native | preact · `mobile_widgets/MobileNoteNavigator.tsx` inside jq `mobile_widgets/sidebar_container.ts` | `MobileNoteNavigator.css` (324) | no | high | |
| MO3 | Mobile tab switcher | native | preact · `mobile_widgets/TabSwitcher.tsx` (modal) | `TabSwitcher.css` (140); `tn-light/dark` (`.modal.tab-bar-modal .tab-card.with-hue`) | partial | medium | |
| MO4 | Mobile note menu (⋯ bottom sheet) | native | preact · `mobile_widgets/mobile_detail_menu.tsx` | `mobile_detail_menu.css`; `style.css` (`.mobile-bottom-menu`) | partial | high | |
| MO5 | Mobile editor toolbar (above the keyboard) | vendored:ckeditor5 | preact · `type_widgets/text/mobile_editor_toolbar.tsx` | `mobile_editor_toolbar.css`; `tn/text.css` (`.ck.ck-toolbar`) | partial | high | |
| MO6 | Mobile sidebar toggle button | native | preact · `mobile_widgets/toggle_sidebar_button.tsx` | `style.css` | no | high | |
| MO7 | Mobile context menus and dropdowns as bottom sheets | native | jq `menus/context_menu.ts`; preact `react/Dropdown.tsx` (`mobile-bottom-menu`) | `style.css` (`body.mobile #context-menu-container.mobile-bottom-menu`, `body.mobile .dropdown-menu`); `tn/base.css` (`body.mobile .dropdown-*`, `#context-menu-cover`) | yes | high | |

---

## Vendored libraries: where each is used

Checked by finding its import in `apps/client/src`.

| Library | Used? | Import site(s) | Surfaces |
|---|---|---|---|
| jquery.fancytree | yes | `widgets/note_tree.ts` | LP3, LP5, M20 |
| CKEditor 5 (`@triliumnext/ckeditor5`) | yes | `react/CKEditor.tsx`, `ribbon/components/AttributeEditor.tsx`, `menus/text_editor_context_menu.ts`, `print.tsx` | N1, C9, C11, P9, MO5 |
| CodeMirror (`@triliumnext/codemirror`) | yes | `type_widgets/code/CodeMirror.tsx`, `markdown/Markdown.tsx`, `mermaid/Mermaid.tsx`, `code/BackendLog.tsx` | N6, N7, N8, N26, N27 |
| tabulator-tables | yes | `collections/table/tabulator.tsx`, `type_widgets/SqlConsole.tsx` | K3, N26 |
| @excalidraw/excalidraw | yes | `type_widgets/canvas/Canvas.tsx` | N9 |
| mind-elixir | yes | `type_widgets/mind_map/MindMap.tsx` | N10 |
| maplibre-gl (+ terra-draw, terra-draw-maplibre-gl-adapter) | yes | `collections/geomap/map.tsx`, `DrawShape.tsx` | K6 |
| **Leaflet** | **no** | not a dependency, no imports | none |
| jsplumb (+ panzoom) | yes | `type_widgets/relation_map/jsplumb.tsx`, `RelationMap.tsx` | N11 |
| fullcalendar (+ @fullcalendar/rrule, rrule) | yes | `collections/calendar/index.tsx`, `calendar.tsx`, `event_builder.ts` | K5 |
| @univerjs | yes | `type_widgets/spreadsheet/Spreadsheet.tsx` | N13 |
| pdf.js (`packages/pdfjs-viewer`) | yes, as an iframe | `type_widgets/file/PdfViewer.tsx` (`pdfjs/web/viewer.html`) | N14 (feeds R10) |
| force-graph | yes | `widgets/note_map/NoteMap.tsx` | N12, C16, R9 |
| mermaid | yes | `services/mermaid.ts`, `type_widgets/mermaid/Mermaid.tsx`, `services/content_renderer.ts` | N7, N2 |
| gridstack | yes | `collections/dashboard/index.tsx` | K8 |
| bootstrap (JS + CSS) | yes | `index.ts` (CSS), `react/Modal.tsx`, `react/Dropdown.tsx`, `services/note_tooltip.ts`, `layout/StatusBar.tsx` | M0, P2, P4, P5, base CSS everywhere |
| katex | yes | `services/math.ts` | N5 |
| draggabilly | yes | `widgets/tab_row.ts` | T1 (drag only) |
| split.js (`packages/splitjs`) | yes | `services/resizer.ts`, `sidebar/RightPanelContainer.tsx`, `helpers/SplitEditor.tsx` | C2 |
| reveal.js | yes | `collections/presentation/index.tsx` | K7 |
| autocomplete.js | yes | `desktop.ts`, `mobile.ts`; `services/note_autocomplete.ts`, `attribute_autocomplete.ts` | P6, P7 |
| highlight.js (`@triliumnext/highlightjs`) | yes | `services/syntax_highlight.ts` | N4 |
| @popperjs/core | yes | `react/Popover.tsx` | P10 (positioning only) |
| react-zoom-pan-pinch, svg-pan-zoom, react-window, mark.js, d3-hierarchy, diff / htmldiff-js, qrcode-generator | yes (behaviour, layout or data only; they produce little or no styled markup) | `react/ImageViewer.tsx`, `helpers/SvgSplitEditor.tsx`, `react/IconPicker.tsx`, `find_in_html.ts`, `react/charts/Treemap.tsx`, `dialogs/revisions.tsx`, `options/totp.tsx` | N17, N7, C3, C27, N28, M4, S5 |

---

## (a) Which layout is current

- **The new layout is the default.** `packages/trilium-core/src/services/options_init.ts:271` sets
  `{ name: "newLayout", value: "true", isSynced: true }`. `initStartupOptions()` (same file, line 381) creates
  any missing option with its default at startup, so a database that never had `newLayout` also gets `true`.
- The flag check is `apps/client/src/services/experimental_features.ts`:
  `isExperimentalFeatureEnabled("new-layout")` returns `isMobile() || options.is("newLayout")`. **Mobile always
  uses the new layout.** The name "experimental" is historical: `options/advanced.tsx:24` hides `new-layout`
  from the experimental list, and users switch it under Settings > Appearance, which offers old and new layout
  and reloads the app (`options/appearance.tsx:224-233`).
- `widgets/containers/root_container.ts:172` adds `experimental-feature-new-layout` to `<body>`, and the CSS
  uses that class to branch.
- The default theme is **Next** (`options_init.ts:71`, `theme = "next"`), which loads `theme-next-light.css`
  plus `theme-next-dark.css` under `prefers-color-scheme: dark`. `theme-light.css` is always loaded as the base.

**Surfaces that differ** (`layouts/desktop_layout.tsx`):

| Only in the old layout | Only in the new layout |
|---|---|
| Split pane buttons in the title row (C5) | Right pane toggle in the tab row (T5) |
| Ribbon with all its tabs (C8–C16) | Fixed formatting toolbar under the tab row (C9 variant) |
| Floating buttons (C19) and backlinks as a floating button (C20) | Note badges (C6) and Note actions (C7) in the title row |
| Content header: read-only and shared info bars (C17) | Inline title (C21) and Note title actions (C22) |
| Promoted attributes above the content (C18) | Status bar (C23), breadcrumb (C24), bottom panels (C25) |
| Legacy jQuery right pane: container, TOC, highlights (R1–R3) | Preact right panel: container, tabs, peek, widgets (R4–R12) |

Shared components that behave differently: `ribbon/NoteActions.tsx` (icon orientation; the Revisions button
only in the old layout); `ribbon/NoteInfoTab.tsx` (created/modified only in the old layout);
`ribbon/NotePathsTab.tsx` (intro text); `attribute_widgets/attribute_detail.tsx:1113-1130` (popup
positioning); `dialogs/PopupEditor.tsx:187` (read-only bar only in the old layout); `layout/TitleRow.tsx:39`
(badges); `options/text_notes.tsx:674,707` (TOC and highlights cards only in the old layout);
`type_widgets/file/PdfViewer.tsx:53` (pdf.js sidebar only in the old layout);
`components/root_command_executor.ts:216` (note map opens a ribbon tab or the right pane). CSS branches on
`body.experimental-feature-new-layout` in `style.css` (zen mode, horizontal layout),
`sidebar/RightPanelContainer.css` (14 rules), `ribbon/Ribbon.css`, `ribbon/NoteActions.css`,
`tn/shell.css` (note-split border and radius, right-pane border, alerts), `tn/pages.css` (settings),
`tree.css` (clone indicator), `note_icon.css`, `note_title.css`, `PromotedAttributes.css`,
`layout/StatusBar.css` and `layout/NoteTitleActions.css`.

**This matters for a restyle:** most new-layout chrome (status bar, breadcrumb, inline title, title actions,
right-pane tabs) has little or no theme-next styling. It is styled by its own component CSS using theme tokens.

## (b) How much theme-next already modernises the Phase 2 chrome

| Surface | Verdict |
|---|---|
| Launcher bar | **Largely modernised.** About 220 lines in `tn/shell.css` plus 17 `--launcher-pane-*` tokens, background-effects variants, and restyled calendar and bookmark dropdowns. The markup is Preact. A restyle here is mostly token work. |
| Tab bar | **Visually modernised, structurally legacy.** About 300 lines in `tn/shell.css` (tab wrapper, active tab, new-tab and close buttons; `--active-tab-*`, `--inactive-tab-*`, `--new-tab-*` tokens). The markup and geometry still come from jQuery `tab_row.ts` and its 276-line inline `<style>`, so every restyle has to override those. |
| Note tree rows | **Substantially modernised, but limited by fancytree's DOM.** About 200 lines in `tn/shell.css` (active pill, selection, icons, protected indicator, tree-actions toolbar) plus 13 `--left-pane-*` tokens. There is no `--tree-*` token family, and `tree.css`, the inline style and the fancytree markup still decide layout. |
| Ribbon | **Barely touched.** `tn/ribbon.css` styles only the tab contents (promoted attributes, file/image properties, similar notes, note info), and `tn/shell.css` only zeroes `.ribbon-container` margin. There are no ribbon tokens. The ribbon is old-layout only. Its new-layout replacements (status bar, breadcrumb, inline title) get almost nothing from theme-next: one status-bar rule and one token. |
| Right panel | **Split verdict.** The old-layout pane (cards, TOC, highlights) is restyled in `tn/shell.css` (about 70 lines, 6 `--right-pane-*` tokens). The new-layout `RightPanelContainer` (tabs, peek, widgets) is styled almost entirely by its own CSS (`RightPanelContainer.css` 343 lines, `TabStrip.css`). theme-next adds only the background and the status-bar border. |
| Split view dividers | **Minimal.** theme-next recolors `.gutter` (`--gutter-color`, `--gutter-hover-color`, transition) and gives note splits rounded corners and an active-split outline. Gutter size and grab area are unchanged (`DEFAULT_GUTTER_SIZE` in `services/resizer.ts`). |
| Context menus | **Modernised.** `menus/context_menu.ts` renders `.dropdown-menu` markup, so `tn/base.css` MENUS applies: radius, padding, backdrop blur, submenu arrows, shortcut text, mobile bottom sheet, and 13 `--menu-*` tokens. The engine is still jQuery, with some structure rules in `style.css`. |
| Toasts | **Fully modernised.** A Preact component (`Toast.tsx`, 154-line `Toast.css`) plus `tn/base.css` TOASTS and `tn/dialogs.css` close buttons: radius, backdrop blur, themed header and `--toast-*` tokens. |

## Other findings

- **Dead CSS:** these selectors match no `.ts`/`.tsx` in the client:
  - `tn/pages.css` `.login-page …`
  - `style.css` "Right Pane Tab Styles" (`#right-pane-tab-container`, `.right-pane-tab`; the live classes are `right-pane-tabs` and `right-pane-tab-body`)
  - `style.css` "AI Chat Widget Styles" (`.chat-widget`, `.chat-message-avatar`, `.chat-input-container`, `.thinking-process`)
- **Inline `<style>` blocks** in jQuery widgets that a restyle has to override or move into files:
  - `tab_row.ts` (276 lines)
  - `quick_search.ts` (133)
  - `toc.ts` (91)
  - `note_tree.ts` (72)
  - `find.ts` (38)
  - `highlights_list.ts` (23)
  - `watched_file_update_status.ts`
- **Surfaces the app theme does not color:**
  - highlight.js code blocks (N4) and CodeMirror editors (N6–N8, N26, N27) use their own theme options
  - reveal.js presentations (K7) use reveal themes
  - pdf.js (N14) is an iframe that only gets injected styles
  - Univer (N13) handles its own dark mode
  - force-graph (N12) reads CSS variables at render time
