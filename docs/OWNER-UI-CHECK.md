# UI delivery gate: owner workflow v2
Date: 24 September 2026. Direction: owner service booklet; ENERGY 2 / RHYTHM 3 / MOTION 1, continuing DESIGN.md and the user's approved during-development mode.

## Hard gate
- R-02 PASS: new UI copy has no em dash.
- R-03 PASS: 390px screenshot inspected; browser scrollWidth assertion passes.
- R-17 PASS: record counts come from data; no marketing statistics.
- R-18 PASS: no testimonials.
- R-23 PASS: navigation simplification explicitly requested; no new visual assets.
- R-24 PASS: garage, registration, guide, settings and passport routes render.
- R-25 PASS: inherited palette contrast ratios: ink/paper 12.93, muted/paper 5.37, white/accent 6.25, ink/selection 11.67.
- R-26 PASS: registration, review/edit/save, AI controls, QR/copy, proof, reset and navigation have real handlers; browser scenarios exercised core controls.
- R-27 PASS: empty motor/history, loading, missing passport, tampering, wallet and provider errors have visible states.
- R-28 PASS: no FAQ.
- R-32 PASS: form labels, native controls and inherited focus outlines; keyboard skip tested.
- R-33 PASS: JSX and CSS authored directly as source and native patches.
- R-34 PASS: no theme toggle; daylight paper theme remains intentional.
- R-35 PASS: production build, Node tests and browser scenarios run; screenshots inspected.
- R-36 PASS: owner statements clearly distinguished from workshop verification.
- R-37 PASS: existing agreed direction retained and DESIGN.md updated.
- R-38 PASS: sample data labelled local demo.

## Purpose gate
- R-01 PASS: no gradients.
- R-04 PASS: no decorative icon library.
- R-06 PASS: Georgia headings continue service-book identity; system sans forms support readability.
- R-07 PASS: dividers separate actual workflow sections, no background grid.
- R-08 PASS: no repeated decorative arrows.
- R-09 PASS: status wording describes actual source; no promotion badges.
- R-10 PASS: no glass surfaces.
- R-12 PASS: no floating card shadows.
- R-13 PASS: no glow.
- R-14 PASS: narrow motorcycle selector and broad form reflect task hierarchy.
- R-19 PASS: inherited brief hover/focus feedback only.
- R-22 PASS: no illustrations.

## Liveliness
- Dials PASS: 2/3/1 specified in DESIGN.md.
- Consistency PASS: title, motor summary, assistant and ledger vary in scale and spacing.
- Focus PASS: motor heading and next form action identify the current task.
- Whitespace PASS: 48px separates selector and work; ledger separated from form.
- Accent PASS: rust buttons indicate primary actions, green selects current motorcycle.
- Identity PASS: paper, serif titles and ledger rules retain maintenance-book character.
- Design read PASS: direction declared before the owner-page rewrite in commentary.

## Craft
- C-1 PASS: selection/form/history organization follows owner workflow.
- C-2 PASS: no decorative controls.
- C-3 PASS: no unrelated marketing sections.
- C-4 PASS: mobile, desktop, errors, denied writes and keyboard checked.
- C-5 PASS: no invented verification claims.
- R-05 PASS: task-centered page, not generic landing template.
- R-11 PASS: existing 3px inputs/4px buttons, no pills.
- R-15 PASS: specific actions Periksa catatan and Simpan catatan.
- R-16 PASS: no promotional AI buzzwords.
- R-20 PASS: receipt, motorcycle and service history vocabulary is specific.
- R-21 PASS: light theme supports daylight reading.
- R-29 PASS: inherited paper/ink palette with rust actions and green state.
- R-30 PASS: no copied product layout.
- R-31 PASS: layout choices documented in DESIGN.md.

Evidence: docs/screenshots/owner-desktop.png, owner-mobile.png, tests/browser/app.spec.js, ai.spec.js, chain.spec.js, docs/VERIFICATION.md.

## Navbar follow-up: 25 September 2026
- PASS: Garasi Saya lists motorcycles without rendering a service form.
- PASS: Tambah Catatan Servis opens a motorcycle selector; selecting one opens its owner-only Gemini/form page.
- PASS: saving returns to that motor's information and history; local EVM scenario still passes.
- PASS: production build and all 8 browser scenarios.
- PASS: garage, information/history and service-entry pages fit 1440px and 390px; six screenshots captured as nav-{garage,motor,service}-{width}.png.
- PASS: desktop motor-information and mobile garage screenshots inspected. Active navbar state uses text underline and aria-current; mobile Menu retains existing behavior.
- PASS: existing owner workflow UI gate remains applicable to palette, typography, controls, consent, permissions and honest demo labels. Updated composition follows the user's requested task navigation.
This navigation change does not change the v2 contract or require another v2 deployment.
