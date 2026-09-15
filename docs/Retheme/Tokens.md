# Lumen design tokens

Lumen is the re-theme's token layer (TDD §3), shipped as a built-in theme family: `lumen` follows the
OS colour scheme, `lumen-light` and `lumen-dark` pin one. It is layered over Next, so every structural
rule of the Next theme still applies; Lumen changes type and colour through custom properties.

## How it loads

`services/theme.ts` resolves a Lumen theme to the Next stylesheets of the same scheme, then
`stylesheets/theme-lumen.css`:

| Theme | Stylesheets after the `theme-light.css` baseline |
| --- | --- |
| `lumen` | `theme-next-light.css`, `theme-next-dark.css` (under `prefers-color-scheme: dark`), `theme-lumen.css` |
| `lumen-light` | `theme-next-light.css`, `theme-lumen.css` |
| `lumen-dark` | `theme-next-dark.css`, `theme-lumen.css` |

`applyColorSchemeAttribute()` sets `data-theme="light"` or `"dark"` on `<html>` for a pinned scheme and
removes it otherwise, at startup (`index.ts`) and after every live theme swap.

## Layers

Three layers, strictly one-directional. Each file lives in `stylesheets/theme-lumen/tokens/`.

| Layer | File | Names | Rule |
| --- | --- | --- | --- |
| Primitives | `primitives.css` | `--p-*` | Raw values. Read only by semantic tokens. |
| Semantic | `semantic.css` | `--surface-*`, `--text-*`, … | Meaning. The only layer that changes between light and dark. |
| Aliases | `aliases.css` | the existing theme contract | Existing variable names re-pointed at semantic tokens. |

Component CSS reads **semantic tokens only** — never a primitive, never a raw value.

## Semantic tokens

| Group | Tokens | Use |
| --- | --- | --- |
| Surfaces | `--surface-sunken`, `--surface-base`, `--surface-subtle`, `--surface-accented`, `--surface-raised`, `--surface-overlay`, `--surface-inverse`, `--surface-emphasis` | App chrome, note content, insets, emphasised fills, cards, menus and dialogs, tooltips and toasts, solid chips such as the note icon. In dark mode each step up is lighter. |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-inverse`, `--text-on-accent`, `--text-on-emphasis` | Body, supporting, muted text; text on inverse surfaces; text on accent, danger or success fills; text on `--surface-emphasis`. |
| Borders | `--border-subtle`, `--border-default`, `--border-strong` | Separators; control outlines; outlines that must reach 3:1. |
| Accent | `--accent-default`, `--accent-hover`, `--accent-active`, `--accent-subtle`, `--accent-text` | Fills, their interaction states, tinted backgrounds, accent-coloured text and links. |
| Focus | `--focus-ring-color`, `--focus-ring-width`, `--focus-ring` | Visible focus indicators (`--focus-ring` is a `box-shadow` value). |
| States | `--state-danger`, `--state-warning`, `--state-success` and their `-subtle` backgrounds | Status colour. Never the only signal: pair it with an icon or text. |
| Interaction | `--state-hover`, `--state-pressed`, `--state-selected` | Translucent fills that read correctly on any surface. |
| Misc. colour | `--selection-background`, `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--backdrop-color`, `--shadow-color` | |
| Code | `--code-keyword`, `--code-string`, `--code-number`, `--code-function`, `--code-type`, `--code-property`, `--code-comment`, `--code-punctuation`, `--code-heading`, `--code-link` | Syntax colours for code editors; see [Code editor theme](#code-editor-theme). |
| Elevation | `--shadow-raised`, `--shadow-floating`, `--shadow-overlay` | `--shadow-raised` is `none` in dark mode, where elevation comes from lighter surfaces. Avoid shadows on repeated elements such as tree rows. |
| Typography | `--font-ui`, `--font-content`, `--font-code`, `--text-size-small`, `--text-size-ui`, `--text-size-content`, `--text-size-heading`, `--line-height-ui`, `--line-height-content`, `--font-weight-regular`, `--font-weight-medium`, `--font-weight-strong` | The font stack includes CJK families; `--line-height-content` leaves room for CJK glyphs. |
| Spacing | `--space-2xs` (2px), `--space-xs` (4), `--space-sm` (8), `--space-md` (12), `--space-lg` (16), `--space-xl` (24), `--space-2xl` (32) | Use logical properties (`padding-inline`, `margin-block-start`). |
| Radius | `--radius-small`, `--radius-control`, `--radius-surface`, `--radius-dialog`, `--radius-pill` | |
| Motion | `--motion-ease`, `--motion-ease-emphasized`, `--motion-duration-fast`, `--motion-duration-base`, `--motion-duration-slow` | Durations drop to 0.01ms under `prefers-reduced-motion`, so `transitionend` still fires. |

## Colour scheme cascade

```css
:root { /* light */ }
@media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { /* dark, following the OS */ }
}
:root[data-theme="dark"] { /* dark, pinned */ }
```

The two dark blocks must declare the same tokens; `lumen-contract.spec.ts` enforces it.

## The theme contract

The 398 variables that `theme-light.css`, `theme-dark.css`, `theme-next-light.css`,
`theme-next-dark.css` and `theme-next/base.css` declare globally are the contract that components and
third-party themes rely on. Lumen never renames or removes one (TDD §3.4). Each is either:

- **aliased** in `aliases.css` to a semantic token (190 today), declared at `html:root` so it outranks
  Next's `:root` rules in either load order; or
- **kept** at Next's value and listed in `scripts/retheme/lumen-contract.json` (208 today): sizes that JS
  measures or caches, hue and lightness components, background-effect variants, log colours, and
  variables that already chain to an aliased one.

When a built-in theme gains a variable, `lumen-contract.spec.ts` fails until the variable is aliased or
added to the keep-list.

## Chrome layer

`stylesheets/theme-lumen/chrome/` restyles Trilium-owned surfaces where Next hard-codes a value in a
rule rather than reading a variable. Every rule starts with `html:root`, for the same reason the aliases
do: it must outrank Next and `style.css` whichever loads last. Where Next sets a value with `!important`
through a variable, Lumen changes the variable instead.

Each file changes only colour, radius, shadow and motion, within the limits of
[Selector coupling](Selector%20coupling.md):

| File | Surface | Left alone |
| --- | --- | --- |
| `shell.css` | Mobile menu cover and sidebar scrim | Their position and `z-index` |
| `launcher.css` | Launcher buttons | Pane width and button margins (measured once for the left-pane split) |
| `tree.css` | Active row pill (accent bar inside Next's `::before`, no shadow), keyboard focus ring, tree actions toolbar, tree settings popup | Row height, vertical padding and border width (FancyTree drop zones); `display` on rows; anything drawn outside the row (`contain: layout paint`) |
| `menus.css` | Dropdown and menu radius, overlay shadow, group headings | `animation` on `.dropdown-menu` (desktop submenus appear through it); margins and borders on submenus |
| `feedback.css` | Toast elevation and radius, note tooltip radius, alert bars | The toast `display` rule (toasts never receive `.show`) |

The tree focus ring marks the focused row when it is not the active one, which happens during
keyboard multi-selection; it is an inset outline because the row clips anything outside it.

## Vendor layer

`stylesheets/theme-lumen/vendors/` covers third-party libraries (TDD Phase 3), one file per library,
with the same `html:root` lift and the same limit to colour, radius, shadow, weight and motion.

| File | Library | Changes | Left alone |
| --- | --- | --- | --- |
| `ckeditor.css` | CKEditor 5 | Active and focus colours (the focus border was the grey `--main-border-color`, so focus rings in editor dialogs and balloons were hard to see), save and cancel buttons, dialog, balloon and block-toolbar radii, dialog shadow, code block label | Balloon offsets and arrow geometry; toolbar layout and wrapping, which CKEditor measures |
| `tabulator.css` | Tabulator | Header text colour and weight, row delimiter, header filter radius, menu text size | Cell padding and row and header heights, which Tabulator measures for virtual rendering |
| `relation-map.css` | jsPlumb relation map | Note box and label borders, radii and shadows; endpoint and drag-hover colours, which `RelationMap.css` pinned to greys | Border widths, padding and `position: absolute !important`, which connections anchor to |
| `excalidraw.css` | Excalidraw | Its accent variables, for light and dark at once | The canvas, which Excalidraw draws from its `theme` prop |

Most of each library's palette already follows Lumen without a rule here: `ckeditor-theme.css` and
`table.css` build theirs from Trilium's variables, which the aliases restyle. Canvas-rendered surfaces
stay partly themed, as the TDD accepts: Mind Elixir reads `--main-background-color`, and jsPlumb
connections, force-graph and MapLibre tiles draw their own colours.

The e2e fixture has no canvas note, so `excalidraw.css` is checked by stylelint but not by a screenshot.

## Code editor theme

CodeMirror themes are extensions rather than stylesheets, so Lumen's is TypeScript:
`packages/codemirror/src/themes/lumen.ts`, registered in `color_themes.ts` as `lumen-light` and
`lumen-dark` and offered in Settings → Code Notes like any other editor theme. Both build the same
theme and differ only in CodeMirror's dark flag, so with "match the application theme" on, set the light
and dark code-note themes to the two Lumen entries.

Every colour it uses is a Lumen token read live through `var()`, so the editor follows the app's colour
scheme without a reload. Each carries a fallback for when another app theme is active: a Trilium theme
variable for the editor chrome, and for syntax colours the same palette as a literal.
`lumen-contrast.spec.ts` checks that those literals equal the `--code-*` tokens in both schemes, and that
every syntax colour reaches 4.5:1 on the editor background.

## Icons

Lumen draws most interface icons from [Tabler Icons](https://tabler.io/icons) while the app still asks
for Boxicons. This is path B of the [icon inventory](inventory/icons.md#2-adoption-paths-for-tabler): a
preview of the look that changes no call site, class name or stored icon.

`scripts/retheme/build-lumen-icons.mts` writes two files from the inventory and the Tabler webfont
release it pins:

| File | Content |
| --- | --- |
| `fonts/tabler/tabler-icons-lumen.woff` | The Tabler glyphs of every `exact`, `close` and `weak` inventory row: 333 glyphs for 385 Boxicons glyphs, 71 KB. Each sits at the codepoint of the Boxicons glyph it replaces, moved so that its ink centres where Boxicons draws. |
| `stylesheets/theme-lumen/icons/tabler.css` | An `@font-face` whose `unicode-range` covers only those codepoints, and `font-family` lists that put it in front of Boxicons: on `.bx`, and on each of the 22 client and editor stylesheet rules that name the Boxicons font themselves (tree chevrons, admonitions, dialog close buttons, …). |

Every glyph the font does not hold still comes from Boxicons, and so do icons from other icon packs. The
font needs a family of its own: the icon pack `<style>` is added after the theme stylesheets
(`index.ts`), and among faces of one family the browser tries the last one defined first.

Because the remap follows codepoints, not call sites:

- a note whose icon is a remapped Boxicons name shows the Tabler glyph under Lumen, in the tree and in
  the icon picker alike, while other note icons keep Boxicons;
- custom task states keep their Boxicons glyph, because `task_states.ts` generates their rules per
  state;
- `bx-alert` and `bx-inbox`, which are not Boxicons 2 names, still render nothing;
- share pages and exports do not load Lumen and keep Boxicons.

Tabler Icons is not a dependency. Rebuild after changing the inventory, or when a stylesheet gains a
rule that names the Boxicons font, from an unpacked copy of the pinned release:

```bash
npm pack @tabler/icons-webfont@3.46.0 && tar -xzf tabler-icons-webfont-3.46.0.tgz
node scripts/retheme/build-lumen-icons.mts --tabler package
```

## Standalone theme

The TDD's first rollout step ships Lumen as a user theme, adoptable without a fork. A user theme is
served from a note download URL, where the relative imports and font URL of `theme-lumen.css` cannot
resolve, so `scripts/retheme/bundle-lumen.mts` inlines the imports and embeds the icon font as a data URL:

```bash
node scripts/retheme/bundle-lumen.mts
```

It writes `dist/retheme/lumen-theme.css` (gitignored; about 83 KB gzipped, 73 KB of it the icon font) with
an AGPL header, the Tabler Icons licence notice and the
install steps: a CSS code note with the bundle as content, labelled `#appTheme=lumen-standalone` and
`#appThemeBase=next`, chosen under Settings → Appearance. The label value is not `lumen`, which this
repository already uses as a built-in theme ID and would take precedence.

As a user theme, Lumen differs from the built-in family in two ways: it follows the operating system's
colour scheme, because Trilium offers no colour-scheme choice for custom themes, and it needs
`#appThemeBase=next`, because it restyles Next rather than replacing it. Code notes keep their own editor
theme; the Lumen editor theme exists only where `packages/codemirror` ships it.

## Guards

| Guard | What it enforces | Run |
| --- | --- | --- |
| `scripts/retheme/lumen-contract.spec.ts` | Every contract variable aliased or kept; aliases at `html:root` and only on semantic tokens; semantic tokens only on primitives; identical dark tiers | `pnpm exec vitest run --project scripts scripts/retheme` |
| `scripts/retheme/lumen-contrast.spec.ts` | WCAG AA in light and dark: 4.5:1 for text pairs and syntax colours (translucent fills composited over their surface), 3:1 for focus rings and strong borders; the code editor's fallback palette equals the `--code-*` tokens | same |
| `scripts/retheme/build-lumen-icons.spec.ts` | The icon font draws exactly the Boxicons codepoints the inventory remaps, centred like Boxicons, and its face covers only those; the icon stylesheet covers every stylesheet rule that names the Boxicons font | `pnpm exec vitest run --project scripts scripts/retheme` |
| `trilium/token-values` (`scripts/stylelint/token-values.mts`) | No raw colour, font size or spacing in `stylesheets/theme-lumen/**` outside the primitives | `pnpm --filter client stylelint` |

## Screenshots

Capture a phase with Lumen active by passing `--theme`, which restores the previous theme afterwards:

```bash
node scripts/retheme/capture-baseline.mts --label phase1-lumen --channel msedge --theme lumen
```
