# Re-theme hardening (Phase 5)

Phase 5 of the re-theme TDD verifies Lumen against the TDD's testing strategy (§6): internationalisation,
performance and accessibility. This records what was checked, how, and with what result — and, as
plainly, what was not. Screenshots live in the gitignored `test-output/retheme/<label>/`; see
[Audit](Audit.md#screenshot-baseline) for how to capture them.

## Performance (§6.5)

| Check | Result |
| --- | --- |
| CSS bundle growth, budget +50 KB gzipped | All Lumen stylesheets together are 7.8 KB gzipped; the standalone bundle is 7.9 KB. |
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

## Not verified

- Electron on Windows, macOS and Linux, and Firefox: every capture ran in Microsoft Edge (Chromium).
- Real mobile devices: mobile widths were emulated in the browser.
- Third-party themes loaded alongside Lumen: none was installed.
- The interaction regression checklist (§6.3): tree drag-and-drop, multi-select, hoisting, tab reorder
  and split view, keyboard shortcuts, protected sessions, menus at viewport edges, CKEditor toolbar
  overflow, collection view switching, and Excalidraw and Mind Elixir pointer input. It needs a person.
