# SETLISM Stage Studio — first implementation, 2026-10-30

## User request and scope

Prepare a polished visual concept, hero and component artwork; begin improving the
existing SETLISM UI and its setlist diagnosis. This branch updates the previous Web
editor at `band/legacy.html`. The BANDHUB shared viewer at `band/index.html`, storage
key/schema and shared link format are unchanged. This is a draft, not a production
release or a declaration that the repository's release gate has passed.

## UI work order

Primary action: add a song. Three main tasks: arrange the set, check the time, resolve
diagnostic findings. Desktop uses a setlist column and an analysis column. Mobile
uses one column with compact imagery and a fixed time/add bar. Detailed style hints,
instrument allocation, comparison and template options have lower visual priority.
All six existing feature tabs remain available. Local image assets only; no CDN,
remote font, analytics or extra account permission is added.

The imagegen concept uses a charcoal/ivory/amber stage aesthetic. The hero, rehearsal
card and empty-state image are delivered separately. Final WebP image payload totals 406,126 bytes. Generated logo-like markings in two
initial images were removed in a targeted imagegen edit before final packaging.

## Diagnosis work order

- One-song sets now receive timing checks. Calculations use the supplied entries.
- Unknown durations are explicitly incomplete; remaining time is not certified.
- Overruns show the required reduction and a link to the time settings.
- Planned gaps and MC are separately added, consistent with the existing app model.
- Instrument changes show the actual configured budget. A 30-second threshold is an
  explicitly labelled rehearsal-check heuristic, not a guarantee or measured minimum.
- Unknown tunings interrupt change inference. Distinct tuning counts are allocation
  options, never a claimed minimum number of guitars. Printed headings agree.
- Tempo similarity uses the full three-song range. Early-peak advice respects the
  selected buildup intent; an opener-first set is not penalized for opening strongly.
- Findings are grouped into checks, missing input and optional artistic hints.
  Diagnostic actions open the corresponding song editor or time dialog. No automatic
  rearrangement, deletion or data transmission occurs.

## Evidence and limits

- `node --test tests/diagnosis-unit.mjs`: 17/17 passed.
- JS syntax checks and `git diff --check`: passed.
- Browser preview: initial sample, time settings, overrun after native key input,
  diagnostic-to-song editing, missing duration followed by correction, song picker
  and rehearsal navigation exercised. The preview uses sample data, not production
  user storage. Browser-extension metadata errors were observed; these are not
  attributed to the app.
- 360/390 CSS-pixel frame previews inspected. No document-level horizontal overflow
  observed at the inspected widths. This is not an iPhone/device or DPR3 test.
- Existing smoke assertions were updated for the deliberately changed diagnosis
  wording/behavior. Full smoke/torture, CSP and site-surface browser suites were not
  executed here. The repository-specific `uicheck` and local playbooks were absent.
- Full offline upgrade behavior, real microphone/audio hardware, native device
  behavior, large libraries and the repository's final release gate remain to test.

Production `main` must not be updated on the strength of this first implementation.
