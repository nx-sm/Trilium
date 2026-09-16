# Re-theme hardening (Phase 5)

Phase 5 of the re-theme TDD verifies Lumen against the TDD's testing strategy (§6): internationalisation,
performance and accessibility. This records what was checked, how, and with what result — and, as
plainly, what was not. Screenshots live in the gitignored `test-output/retheme/<label>/`; see
[Audit](Audit.md#screenshot-baseline) for how to capture them.

## Performance (§6.5)

| Check | Result |
| --- | --- |
| CSS bundle growth, budget +50 KB gzipped | All Lumen stylesheets together are 10.1 KB gzipped, 2 KB of it the icon rules. The Tabler icon font is a separate 71 KB file that loads only while Lumen is active (Boxicons' font is 116 KB). The standalone bundle embeds that font as a data URL and is 83 KB gzipped, **over the budget**: the font accounts for about 73 KB of it. |
| `prefers-reduced-motion` on every transition | Lumen's transitions read `--motion-duration-*`, which drop to 0.01ms under reduced motion, so a `transitionend` that JS awaits still fires. A scan of the Lumen chrome and vendor stylesheets finds no literal duration. |
| No `box-shadow` or `filter` on repeated tree rows | The tree's active pill drops its shadow; no rule adds one to rows. |
| Tree usable at 100,000 notes | **Not measured.** Lumen changes no row geometry, but tree scroll was not profiled. |

## Accessibility (§6.6)

| Check | Result |
| --- | --- |
| WCAG AA contrast in light and dark | Enforced by `scripts/retheme/lumen-contrast.spec.ts`: 4.5:1 for text on every surface (translucent fills composited), for text on accent, danger, success, inverse and emphasis fills, and for all ten syntax colours; 3:1 for focus rings and strong borders. It caught dark tertiary text on a hovered overlay row at 4.27:1 in Phase 1, fixed by lightening `--p-neutral-400`. |
| Visible focus indicators | Form and menu focus outlines read the accent focus ring through the aliases. CKEditor's focus border was the grey `--main-border-color` and now reads the focus ring. The note tree marked no keyboard-focused row; it now draws an inset focus ring. **The tree and CKEditor rings were not verified visually**: the capture matrix does not open keyboard multi-selection or editor dialogs. |
| State never encoded in colour alone | Not audited. Lumen adds no new state colours; the active tree row carries both a tint and an accent bar. |
| Keyboard traversal and screen reader smoke test | **Not performed.** Phase 4 added no new components; both remain for a person. |

## Internationalisation (§6.4)

Captured with Lumen active, on the desktop layout at 768, 1280 and 1920 px and the mobile layout at 360
and 768 px, light and dark, for the text note, tree context menu, jump-to-note dialog and appearance
settings (`--option locale=<id>`; 36 shots per locale, no failures).

| Locale | Checked | Result |
| --- | --- | --- |
| Arabic (`ar`) | Right-to-left layout | The shell mirrors: launcher and tree on the right, tabs flowing leftwards, the right panel on the left. The tree's active pill draws its accent bar on the right, as `border-inline-start` should. The context menu mirrors icons, shortcuts and submenu arrows; shortcut text stays left-to-right. |
| German (`de`) | String overflow at 1280 px | Long compounds fit their labels and controls. |
| Russian (`ru`) | String overflow at 360 px | Long labels wrap onto two lines without overflow. |
| Chinese (`cn`) | CJK font and line height | Chinese falls back to a CJK sans while Latin text stays in Inter; line height leaves the glyphs unclipped. |

Defects found, none caused by Lumen:

- In Arabic, the note-type switcher row under the title ("Switch from text to") is clipped at its start
  edge.
- In every locale, the last card of the layout-style choice in Settings → Appearance is cut off by the
  dialog at 1280 px.
- The German catalogue has no translation for the description of "Use different fonts".

Repeated for Vellum once it set its own type sizes, and now that it is the default: a 144-shot baseline
and 46 shots per locale, no failures. Its smaller interface type and looser reading rhythm change none
of the outcomes above.

| Locale | Result under Vellum |
| --- | --- |
| Arabic (`ar`) | Mirrors as before: launcher and tree on the right, the outline panel on the left, tabs and breadcrumbs flowing leftwards. The active tree row, which Vellum marks with a fill rather than Lumen's accent bar, stays legible mirrored. |
| German (`de`) | Labels still fit; the settings sidebar truncates "Passwort & Authentifizierung" with an ellipsis rather than overflowing. |
| Russian (`ru`) | At 360 px, long labels wrap onto two lines with no overflow, and read at the 14 px interface size. |
| Chinese (`cn`) | Renders without clipping at that size, and the line height leaves the glyphs room. |

Both defects found under Lumen are still there, and still not a theme's doing: the layout-style card cut
off by the dialog at 1280 px, and the untranslated German description of "Use different fonts".

UK conventions: `firstDayOfWeek` defaults to `1` (Monday) in `options_init.ts`, and both the calendar
collection and date notes read it. Date and time formats were not examined.

## Logical properties

The client stylesheets carried 142 physical properties that stylelint's `property-layout-mappings` rule
rejects, in 53 files, so `pnpm --filter client stylelint` failed before any re-theme change. They are now
logical properties (`margin-inline-start`, `inset-inline-end`, `border-inline-start`, …) in 52 files; in
left-to-right layout each renders exactly as the physical property it replaces. Nine sites keep a
physical property, each behind a `stylelint-disable-next-line` comment that gives the reason:

- seven elements centred with `left: 50%` (or `right`) and `translateX()`, where a logical inset would
  move in right-to-left layout while the transform stays physical;
- `bx-pull-left` and `bx-pull-right` in `boxicons-compat.css`, whose floats are physical by name.

`.ocr-text-section` aligns its text to `start`, to match its converted border. Stylelint now reports no
violation in the client.

Captured with Lumen active before and after the conversion, for the text note, tree context menu,
jump-to-note dialog, appearance and text-note settings, and the board and table collections, at every
width in light and dark (58 shots per set, each set against a freshly started fixture server):

| Comparison | Result |
| --- | --- |
| English, two sets before (noise floor) | 48 of 58 identical. The jump-to-note dialog lists recent notes, which differ between runs; two shots differ by 2 px. |
| English, before and after | 54 of 58 identical; the other four are the jump-to-note dialog and one 2 px difference already in the noise floor. |
| Arabic, before and after | 26 of 58 identical. In the settings dialog, the close and maximise buttons move from beside the "Options" heading to the dialog's end edge, matching left-to-right layout, and the font rows' padding and chevrons mirror. The remaining differences are antialiasing, under 900 px per shot. |

Found in passing, and present before the conversion: in Arabic at the 768 px mobile layout, the settings
sheet runs past the left edge of the viewport, while in English it fits.

## Interaction regression checklist (§6.3)

`packages/trilium-e2e/src/theme_interaction.spec.ts` drives most of the checklist under each built-in
token theme. It lives in the shared suite, so both e2e projects run it: `pnpm --filter server e2e` and
`pnpm --filter standalone e2e`, six tests per theme. Every test switches the theme, waits for its
stylesheet, exercises the interaction and restores it afterwards.

All twelve pass under both projects: inside the whole `server` suite, and on their own under
`standalone` (`pnpm --filter standalone e2e theme_interaction`, 51 s, no retries). The server suite
itself is not green locally, and was not before this theme work: seven tests fail — the mobile
translation check, both launcher and tree activation tests, three PDF tests and the maths popup — and
every one of them runs before this spec, so neither it nor the theme can be their cause. Measured by
running the suite with only the default theme differing: ten failures with `next`, nine with `vellum`,
and seven once this spec restored the theme it had found and unhoisted the tree before starting. Those
last three were this spec's own leavings, which had been breaking `tree.spec.ts` after it.

| Checklist item | Covered |
| --- | --- |
| Tree: expand and collapse, multi-select, drag reordering | This spec, under Lumen and Vellum |
| Tree: hoisting | `layout/tree.spec.ts`, under the default theme |
| Tab bar: open and close | This spec, under Lumen and Vellum |
| Tab bar: reorder, split view | `layout/tab_bar.spec.ts` and `layout/split_pane.spec.ts`, under the default theme |
| Context menus at viewport edges | This spec: opened against the bottom edge, it stays inside the viewport and still closes on a click outside |
| CKEditor toolbar overflow at narrow widths | This spec: the classic toolbar at 800 px stays inside its bar, and its overflow group opens inside the viewport |
| Collection view switching (table → calendar → board) | This spec, under Lumen and Vellum |
| Mind Elixir pointer input | This spec: a node opens its panel |
| `F1` in-app help | `help.spec.ts`, under the default theme |
| Other keyboard shortcuts | **Not covered.** |
| Protected note entry and timeout | **Not covered.** The e2e fixture's password is unknown by design (`generate-protected-fixture.mts`). |
| Excalidraw pointer input | **Not covered.** The fixture holds no canvas note. |

Found while writing the spec: the tree's context menu is around 600 px tall, so in a viewport shorter
than that it opens above the top edge and its first items cannot be reached (measured at 520 px, where
its top sat at −5 px). Observed under Lumen; not checked under another theme, though no Lumen rule
changes the menu's size.

## Not verified

- Electron on Windows, macOS and Linux, and Firefox: every capture ran in Microsoft Edge (Chromium).
- Real mobile devices: mobile widths were emulated in the browser.
- Third-party themes loaded alongside Lumen: none was installed.
- The parts of the interaction checklist (§6.3) that no test drives: protected note entry and timeout,
  Excalidraw pointer input, and keyboard shortcuts other than `F1`. They need a person.
