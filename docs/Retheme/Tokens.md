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
| Surfaces | `--surface-sunken`, `--surface-base`, `--surface-subtle`, `--surface-accented`, `--surface-raised`, `--surface-overlay`, `--surface-inverse` | App chrome, note content, insets, emphasised fills, cards, menus and dialogs, tooltips and toasts. In dark mode each step up is lighter. |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-inverse`, `--text-on-accent` | Body, supporting, muted text; text on inverse surfaces; text on accent, danger or success fills. |
| Borders | `--border-subtle`, `--border-default`, `--border-strong` | Separators; control outlines; outlines that must reach 3:1. |
| Accent | `--accent-default`, `--accent-hover`, `--accent-active`, `--accent-subtle`, `--accent-text` | Fills, their interaction states, tinted backgrounds, accent-coloured text and links. |
| Focus | `--focus-ring-color`, `--focus-ring-width`, `--focus-ring` | Visible focus indicators (`--focus-ring` is a `box-shadow` value). |
| States | `--state-danger`, `--state-warning`, `--state-success` and their `-subtle` backgrounds | Status colour. Never the only signal: pair it with an icon or text. |
| Interaction | `--state-hover`, `--state-pressed`, `--state-selected` | Translucent fills that read correctly on any surface. |
| Misc. colour | `--selection-background`, `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--backdrop-color`, `--shadow-color` | |
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

- **aliased** in `aliases.css` to a semantic token (189 today), declared at `html:root` so it outranks
  Next's `:root` rules in either load order; or
- **kept** at Next's value and listed in `scripts/retheme/lumen-contract.json` (209 today): sizes that JS
  measures or caches, hue and lightness components, background-effect variants, log colours, and
  variables that already chain to an aliased one.

When a built-in theme gains a variable, `lumen-contract.spec.ts` fails until the variable is aliased or
added to the keep-list.

## Guards

| Guard | What it enforces | Run |
| --- | --- | --- |
| `scripts/retheme/lumen-contract.spec.ts` | Every contract variable aliased or kept; aliases at `html:root` and only on semantic tokens; semantic tokens only on primitives; identical dark tiers | `pnpm exec vitest run --project scripts scripts/retheme` |
| `scripts/retheme/lumen-contrast.spec.ts` | WCAG AA in light and dark: 4.5:1 for text pairs (translucent fills composited over their surface), 3:1 for focus rings and strong borders | same |
| `trilium/token-values` (`scripts/stylelint/token-values.mts`) | No raw colour, font size or spacing in `stylesheets/theme-lumen/**` outside the primitives | `pnpm --filter client stylelint` |

## Screenshots

Capture a phase with Lumen active by passing `--theme`, which restores the previous theme afterwards:

```bash
node scripts/retheme/capture-baseline.mts --label phase1-lumen --channel msedge --theme lumen
```
