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

## Reference fidelity revision

- Reason: the first implementation had oversized spacing, a wide verbose diagnosis
  panel and a duplicate sticky action bar that obscured songs. Follow the supplied
  concept's continuous black stage frame, 2.15:1 workspace and compact table rows.
- Primary action is inline song addition. The three working tasks remain song order,
  time budget and checks. Detailed reasoning and chart comparison settings use native
  disclosures; warning titles and evidence stay visible. All six tool tabs remain.
- Desktop columns show duration, BPM, tuning and memo. Mobile prioritizes duration,
  BPM and tuning on one line, with full metadata retained in the editor and tooltip.
- No new image, dependency, network call, permission, storage or diagnosis rule.
- This revision passes JS syntax and diff checks. The existing 17 diagnosis tests
  passed before the final presentation-only metadata change. Browser inspection
  covers desktop and 360/390 CSS-pixel frame layouts; final release gates above remain.

## Release candidate verification (2026-10-30 JST)

- Windows Chrome on an isolated checkout: smoke 86 PASS, torture 44 PASS,
  viewer 11 PASS (including previous public cache upgrade and offline sharing),
  CSP 57 PASS including legacy editor and privacy page. All exited 0.
- `studio-release.mjs` passes: old main HTML with current app.js remains usable;
  an MC edit writes nonempty saved data, current-shell reload preserves exact
  bytes; 360/390 widths × light/dark × DPR3 pass controls and offline reload.
- Diagnosis/security 22 Node tests pass. Three isolated mutation copies are
  rejected by assertion failures (disabled overtime, missing duration accepted,
  MC treated as sufficient). Mutation runner is included in CI.
- uicheck GREEN against the immediately preceding studio candidate: console errors
  0, overflow false, small inputs 0, tap targets below44px 0, low contrast 0.
  It still counts 8 font sizes (including chart text) and 61 unknown contrast
  cases for image/gradient surfaces. GREEN does not certify all aesthetics.
- Independent Codex-context source review PASS; final source reviewed includes
  cached-shell guards. This does not replace real iPhone/microphone checks.
- Dedicated SETLISM manifest starts legacy.html; BANDHUB manifest/viewer unchanged.
  Privacy page and offline cache entries added. CI now runs full studio regression.
- Execution incident: an early Windows clone had not finished when the runner
  started. Directory change failed and npm attempted to run in the connector's
  directory; npm ci rejected missing lockfile and build failed on missing tsc.
  Those results were discarded. Final runners stop on directory errors and use
  literal .ps1 files to avoid nested PowerShell variable expansion. Candidate
  tests were rerun from the explicit checkout.

Public main remains pending the repository-required owner smartphone check.
The owner-approved design is retained; a separate owner-private review site is
for that check only. Its storage is separate from the public app. Do not import
private production data for testing. No claim of real-device testing is made.
