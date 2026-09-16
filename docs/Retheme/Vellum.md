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

**Headings carry weight, not size.** Next draws `h1`–`h6` at weight 300, which reads as a web page;
Vellum sets them in the weight of its own bold text and gives each more room above than below, so a
heading binds to the text it introduces. The first heading of a note keeps no gap above it.

Those three measurements — the room above and below a heading, and the gap after a paragraph — are
named in `theme-vellum/tokens/primitives.css` as `--v-rhythm-*` and read straight from the chrome, the
one place Vellum's chrome reads a primitive. They are ems of the note's own type, so they follow the
reader's font size, and no semantic token carries type-relative spacing: `--space-*` is in pixels.
Declaring one in Lumen that only Vellum reads would leave Lumen with an unread token, which is the
very fault this theme found in `--line-height-content`.

## What it deliberately leaves alone

Each of these is a deliberate omission rather than an oversight:

- **Font families.** `--main-font-family` and its siblings stay as Lumen leaves them: Vellum changes
  the size of the type, not the typeface.
- **The width of the note.** `root_container.ts` sets `--preferred-max-content-width` as an inline
  style on `body` from the `maxContentWidth` option. Vellum suits a narrower column, but that is the
  reader's setting to make.
- **Note tree row geometry.** FancyTree derives its drop zones from row height and vertical padding
  ([Selector coupling](Selector%20coupling.md)), so Vellum changes neither. The rows come out shorter
  anyway, because their height is `2.4em` of a tree that now sets its type smaller.

## Type size

Next leaves every size at `normal`, which makes Trilium a 16px interface, and the note larger still:
`style.css` gives `.ck-content` a further `1.1em`, so its text lands near 17.6px. Vellum sets the sizes
a document app uses, in `theme-vellum/tokens/aliases.css` and beside them in the chrome:

| Variable | Vellum | Next |
| --- | --- | --- |
| `--main-font-size` | `--text-size-ui` (0.875rem) | `normal` |
| `--tree-font-size` | `--text-size-ui` (0.875rem) | `normal` |
| `--detail-font-size` | `--text-size-content` (1rem) | `normal` |
| `--ck-content-font-size` | `--v-content-scale` (1em) | 1.1em |

Setting them is a theme's business rather than an intrusion. `/api/fonts` serves an empty stylesheet
until the reader turns on "Use different fonts", and what it serves then is written on `body`, which
outranks every `html:root` rule here — so a reader who chooses their own sizes keeps them, and everyone
else gets the theme's. The sidebar's rows follow the tree's type down, to about 34px from 38px, with no
change to the geometry FancyTree measures.

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

```bash
node scripts/retheme/bundle-theme.mts --theme vellum
```

writes `dist/retheme/vellum-theme.css` (gitignored): Lumen's stylesheets inlined first, then Vellum's,
each file carried once, with the icon font embedded as a data URL. It is 87 KB gzipped against Lumen's
83 KB — the difference is Vellum's own layer, and about 73 KB of either is the font.

Install it as a CSS code note labelled `#appTheme=vellum-standalone` and `#appThemeBase=next`, chosen
under Settings → Appearance. As a user theme it follows the operating system's colour scheme, because
Trilium offers no colour-scheme choice for custom themes.

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
