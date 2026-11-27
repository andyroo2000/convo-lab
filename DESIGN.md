# ConvoLab Design System

The current design reference is the signed-in **Journal and Study** experience at
[convo-lab.com](https://convo-lab.com). Use their green workspace header, cream
paper surfaces, serif headings and controls, and restrained green and blue
accents when building new ConvoLab interfaces.

This guide replaces the former Bold Editorial design system. The old five-color
content taxonomy, cyan/navy retro shell, Archivo Black headlines, Oswald labels,
heavy borders, and offset block shadows are not the default for new work.
Legacy rules still exist in the repository; their presence does not make them
the current brand.

## Reference order

1. Inspect the relevant signed-in Journal and Study screens on the live site.
2. Read their route-specific styles and components from an up-to-date checkout
   of the default branch.
3. Use this guide to carry that system into new screens and companion tools.

Do not infer the current design from the beginning of styles/index.css,
tailwind.config.js, an older local checkout, or the iOS theme alone. Route
styles override legacy globals. The public landing page has its own presentation
and is not the reference for application controls.

### Implementation sources

| Surface | Source |
| --- | --- |
| Wordmark, fonts, green header, authentication | [journalBrand.css](client/src/components/common/journalBrand.css), [JournalBrand.tsx](client/src/components/common/JournalBrand.tsx) |
| Workspace switcher and navigation | [workspaceNavigation.css](client/src/components/common/workspaceNavigation.css), [Layout.tsx](client/src/components/common/Layout.tsx) |
| Journal toolbar, menus, drawer and audio | [journalDesk.css](client/src/features/journal/journalDesk.css) |
| Journal sheets and ruled writing surface | [journalPaper.css](client/src/features/journal/journalPaper.css) |
| Journal dialogs and appearance choices | [journalEntryDialogs.css](client/src/features/journal/journalEntryDialogs.css), [journalAppearance.css](client/src/features/journal/journalAppearance.css) |
| Study overview and Daily Audio | [studyNotebook.css](client/src/components/study/studyNotebook.css) |
| Focused study session | [studyWashi.css](client/src/components/study/studyWashi.css) |
| Public landing page, a separate surface | [landing.css](client/src/features/landing/landing.css) |

## Visual principles

- Make the writing, study content, and next action easy to read.
- Use warm paper surfaces, thin rules, rounded panels, and subtle shadows.
- Use green for navigation and primary study actions; reserve blue-gray for
  audio and related supporting panels.
- Keep interface copy specific. Use labels such as “Planning notes,” “Next
  step,” “Add feature idea,” and “Report bug or fix.” Omit decorative slogans,
  generic motivational copy, and repeated explanations of the page's purpose.
- Preserve visible keyboard focus, accessible labels, clear selected states,
  and at least 44px targets for primary controls.

## Colors by role

These values describe the current surfaces, not interchangeable global colors.

| Role | Value | Current use |
| --- | --- | --- |
| Workspace green | #60b048 | Journal and Study header |
| Header edge | #407c35 | Dark green left edge; Journal action/selection accents |
| Wordmark yellow | #fff29c | CONVO-LAB on the green header |
| Header navigation | #ffffff | Workspace label and controls |
| Study ink | #25483b | Study headings and main text |
| Study secondary ink | #53655c | Supporting descriptions |
| Journal writing ink | #4b1800 | Journal text on paper |
| Study session ink | #242424 | Focused study cards |
| Study paper | #fffdf4 | Overview cards |
| Journal paper | #fffdf5 | Sheets, toolbar and menus |
| Journal dialog paper | #fffdf7 | Dialog backgrounds |
| Washi backdrop | #f3eddf | Focused study session |
| Study rules | #c9cfc0 | Thin card borders and separators |
| Primary study action | #386749 | Filled pill buttons with white text |
| Muted green accent | #819b85 | Study surface accents |
| Soft selection | #e7edcf / #edf3e6 | Workspace menu / Journal selections |
| Audio paper | #e8eff0 | Daily Audio panel |
| Audio ink | #294b55 | Audio headings and text |
| Audio rule | #abc7cc | Audio panel border |
| Audio action | #386577 | Filled audio controls |
| Destructive action | #9e443d | Journal deletion controls |
| Destructive tint | #faeae5 | Destructive hover/feedback surface |

Journal narration additionally uses pale blue #e5eefb, border #d0dfef,
and playback accent #6796ec. Keep those local to their audio context rather
than reverting the whole application to the previous periwinkle palette.

For a companion tracker, use the Study paper, ink, and button roles. Keep type
and status labels explicit; color must not be their only distinguishing cue.

## Typography and wordmark

| Role | Typeface | Treatment |
| --- | --- | --- |
| CONVO-LAB wordmark | Anton, weight 400 | Uppercase, hyphenated; yellow on green |
| Japanese wordmark | Journal Kana | コンボ・ラボ; shown in the full brand lockup |
| Full brand section label | Barlow Condensed, weight 800 | Spaced uppercase label, e.g. JOURNAL |
| App headings and serif controls | Crimson Pro | Usually weight 500–550; sentence case |
| Interface body and metadata | Inter | Readable regular/medium weights |
| Japanese serif fallback | Noto Serif JP, then Georgia/serif | Used with study serif content |
| Journal writing | Learner's selected font | Respect appearance settings; do not force the logo or heading font |

The shared compact workspace header displays CONVO-LAB without the Japanese
line. Its wordmark is 36px on desktop, 30px below 640px, and 26px below 380px.
The public landing page's “Journal by ConvoLab” wordmark is a separate treatment.

Study page headings use Crimson Pro at clamp(2.2rem, 5vw, 3rem), line-height 1,
weight 550, and letter-spacing -0.035em. Section headings are approximately
1.85rem, line-height 1.15. Study action labels use 1.1rem Crimson Pro, weight 550.

Use Inter for supporting interface text, typically 16px body and 14px metadata.
Journal menus and workspace controls use roughly 18–20px Crimson Pro.
Inputs should remain at least 16px. Do not shrink Japanese content to match
compact English metadata.

### Font assets

Reuse the bundled assets and their licenses:

- client/public/fonts/Anton-Regular.woff2
- client/public/fonts/BarlowCondensed-ExtraBold.woff2
- client/public/fonts/Inter-Variable.woff2
- client/public/fonts/JournalKana.woff2
- client/public/fonts/Nunito-Variable.woff2 when the relevant component calls for it
- client/public/journal-landing/CrimsonPro.woff2

Font license files sit alongside these assets. Keep them with copied fonts.
Use font-display: swap and sensible fallbacks. Do not replace these with
Archivo Black or Oswald when extending the current application.

## Surfaces and controls

### Workspace navigation

Use the shared green header and compact wordmark. Workspace switching and
account actions belong in the header; active controls are quietly highlighted.
The switcher uses a cream panel with rounded corners and soft green selection.
Maintain the existing responsive behavior instead of introducing a saturated
sidebar for every content category.

### Journal

Journal is a writing surface: cream notebook paper, subtle horizontal ruling,
a muted red margin rule, and a lightly torn decorative edge. Keep the edge
decoration separate from interactive content so it does not clip text or focus.

Its toolbar is cream, with a thin border, 15px corners, and a green bottom rule.
Menus and drawers use 12–14px corners, thin neutral borders, and soft shadows.
Version selection and primary actions use rounded pills. Respect the learner's
font and writing-size preferences.

### Study

Use cream cards with thin green-gray borders, approximately 14px corners,
serif headings, and restrained shadows such as 0 4px 9px #2136290c.
Study content and available actions determine the layout; do not copy a
particular card arrangement blindly across routes or viewport sizes.

Primary actions have a green fill, white text, a 1px green border, pill radius,
and a minimum 44px height. Secondary actions can be outlined or text links.
Daily Audio uses a muted blue-gray panel, a thin blue rule, and blue-gray controls.

Focused review uses the washi backdrop with a subtle fiber texture and removes
the normal workspace header. This is specific to focused sessions, not a reason
to hide navigation throughout the application.

### Forms and dialogs

Use cream or near-white fields, thin borders, readable labels, and visible
focus. Keep errors next to the relevant operation. Show saving, success, and
failure states clearly. Auto-save where the workflow already supports it;
explicit submission is appropriate for creating an entry or sending a bug report.

On small screens, stack controls or use the existing bottom-sheet pattern.
Avoid horizontal page overflow; allow deliberate scrolling within navigation
or bounded menus when appropriate.

## Applying this system to companion sites

A feature/bug tracker should inherit the current wordmark, fonts, green
navigation, cream cards, pill actions, and thin rules. Keep content and controls
plain: feature ideas, bugs, fixes, statuses, search, planning notes, and next steps.

Do not add faux notebook decoration to every component. Journal's writing
rules and torn edges serve its writing experience; Study's quieter cards are
the closer reference for a list/detail planning tool.

## Verification before publishing

- Compare the result against both signed-in Journal and Study.
- Check loaded fonts and computed styles, not only old token names.
- Check desktop and phone widths, long titles, dialogs, selected states, and focus.
- Verify the current source branch and note any live/source mismatch.
- Preserve data and behavior when changing presentation.

Updated November 27, 2026. Reference: live Journal and Study, checked against
default-branch source at acd8c179. This guide supersedes Design System 1.0
(Bold Editorial, November 24, 2025).
