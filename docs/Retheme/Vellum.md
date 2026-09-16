# Vellum

Vellum is a document-first variant of [Lumen](Tokens.md), shipped as a built-in theme family:
`vellum` follows the OS colour scheme, `vellum-light` and `vellum-dark` pin one. It exists to answer
a narrower question than Lumen does — what Trilium looks like when the note, rather than the
application around it, is the brightest and busiest thing on screen.

## How it loads

Vellum is a second token layer over Lumen, so `services/theme.ts` resolves it to three stylesheets:

| Theme | Stylesheets after the `theme-light.css` baseline |
| --- | --- |
| `vellum` | `theme-next-light.css`, `theme-next-dark.css` (under `prefers-color-scheme: dark`), `theme-lumen.css`, `theme-vellum.css` |
| `vellum-light` | `theme-next-light.css`, `theme-lumen.css`, `theme-vellum.css` |
| `vellum-dark` | `theme-next-dark.css`, `theme-lumen.css`, `theme-vellum.css` |

Loading Lumen underneath is what keeps Vellum small: Lumen's 190 aliases already point the theme
contract at semantic tokens, so Vellum redeclares semantic tokens and the whole contract follows. It
inherits Lumen's chrome and its Tabler icon font unchanged.

## What it changes

| Layer | File | Change |
| --- | --- | --- |
| Primitives | `theme-vellum/tokens/primitives.css` | A warm neutral ramp mixed towards the text colour rather than towards blue, a quieter accent, small even radii, and a looser pair of line heights. |
| Semantic | `theme-vellum/tokens/semantic.css` | The note surface becomes the brightest step and the chrome sits below it; borders drop to nearly the background, so panels separate by tint; interaction fills are neutral rather than accent-tinted, so rows do not flash blue. |
| Chrome | `theme-vellum/chrome/content.css` | The reading rhythm (see below) and the space around the note's title. |
| Chrome | `theme-vellum/chrome/tree.css` | The active tree row loses Lumen's accent bar and is marked by its tint alone. |

Almost everything arrives through tokens. The chrome layer holds only what no token reaches, which is
why it is two short files rather than the five Lumen needs.

**The active tree row** is the one place where dropping a mark needed something back. Lumen draws an
accent bar inside Next's `::before`; Vellum marks the row with its fill instead, which the first
screenshots showed was too faint at 7% of the neutral. The selected fill is now 12% in light and 15%
in dark, a step clear of both the hover fill and the sidebar's own tint. The row is therefore
distinguished by a background fill rather than by a change of hue, and keyboard focus still draws the
inset ring Lumen adds, so neither signal is colour alone (TDD §6.6).

**The reading rhythm is the one token nothing consumed.** Lumen declares `--line-height-content`, but
no rule reads it, so the value never reached the page. Vellum applies it to `.ck-content`, which
CKEditor puts on both the editable and the read-only body, and carries the same value in
`--ck-content-line-height` for anything reading the variable instead.

## What it deliberately leaves alone

These are the three levers a theme should not pull, and each is a deliberate omission rather than an
oversight:

- **Font sizes and families.** `--main-font-size`, `--tree-font-size` and the `--detail-font-*` pair
  come from the user's font options through `/api/fonts`, and Lumen's keep-list leaves them at Next's
  values. A theme that set them would silently overrule a setting the user chose.
- **The width of the note.** `root_container.ts` sets `--preferred-max-content-width` as an inline
  style on `body` from the `maxContentWidth` option. Vellum suits a narrower column, but that is the
  user's setting to make.
- **Note tree row geometry.** FancyTree derives its drop zones from row height and vertical padding
  ([Selector coupling](Selector%20coupling.md)), so the sidebar can be made quieter but not shorter.
  Row height is `em`-based, so a smaller tree font shrinks rows without any theme change.

## What it is not

Vellum is inspired by the look of modern document apps, not a copy of any of them, and a theme cannot
make Trilium into one. The tab bar, the launcher bar and the absence of page cover images are
structural: they are part of what Trilium is, and changing them is component work, not styling.

## The code editor

`packages/codemirror/src/themes/lumen.ts` reads the `--code-*` tokens live through `var()`, so with a
Lumen editor theme selected the editor follows whichever token theme is active, Vellum included. Only
the literal fallbacks it carries for when neither theme is active remain Lumen's, which is why
`lumen-contrast.spec.ts` checks those against Lumen's tokens alone.

## Standalone bundle

`scripts/retheme/bundle-lumen.mts` bundles Lumen only. Vellum has no single-file build yet; as a user
theme it would need the same treatment, with its own imports inlined on top of Lumen's.

## Guards

| Guard | What it enforces for Vellum |
| --- | --- |
| `scripts/retheme/lumen-contract.spec.ts` | Vellum redeclares only tokens Lumen declares, builds them from Vellum's own primitives, and declares identical dark tiers. |
| `scripts/retheme/lumen-contrast.spec.ts` | WCAG AA in light and dark, with Vellum's tokens merged over Lumen's in cascade order. |
| `trilium/token-values` | No raw colour, font size or spacing outside `theme-vellum/tokens/primitives.css`. |

```bash
pnpm exec vitest run --project scripts scripts/retheme
pnpm --filter client stylelint
node scripts/retheme/capture-baseline.mts --label vellum --channel msedge --theme vellum
```
