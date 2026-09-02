# MOTION_SPEC

Motion rule: **Feedback / State Transition / Brand Motion 以外の目的では動かさない。**  
実装はCSS transition/keyframesまたはWeb Animations API。解析中・推論中はCSSだけ。layout propertiesをanimationしない。

## M-01 — HOME_HERO_ENTRY
- **MOTION_ID:** M-01
- **PURPOSE:** Brand Motion
- **TARGET:** Home Evidence Bundle Artwork + hero headline
- **TRIGGER:** first paint after document ready
- **PROPERTIES:** `transform`, `opacity`
- **FROM → TO:** artwork `translate3d(12px,-6px,0) scale(.99)` / `.0` → `translate3d(0,0,0) scale(1)` / `1`; headline `translateY(8px)` / `.0` → `0` / `1`
- **DURATION_MS:** artwork 420; headline 280
- **EASING:** `cubic-bezier(.2,.8,.2,1)`
- **DELAY:** artwork 0; headline 70ms
- **INTERRUPTIBILITY:** user interaction does not wait; animation may finish or be cancelled on navigation
- **REDUCED_MOTION:** no transform; artwork/headline visible immediately

## M-02 — MENU_OPEN_CLOSE
- **MOTION_ID:** M-02
- **PURPOSE:** State Transition
- **TARGET:** mobile navigation overlay / panel
- **TRIGGER:** menu toggle
- **PROPERTIES:** `opacity`, `transform`
- **FROM → TO:** overlay `0→1`; panel `translateY(-8px)→0`
- **DURATION_MS:** 180
- **EASING:** `cubic-bezier(.2,.8,.2,1)`
- **DELAY:** 0
- **INTERRUPTIBILITY:** reversible immediately
- **REDUCED_MOTION:** opacity 80ms only

## M-03 — CTA_PRESS
- **MOTION_ID:** M-03
- **PURPOSE:** Feedback
- **TARGET:** primary/secondary buttons
- **TRIGGER:** `pointerdown` / keyboard active
- **PROPERTIES:** `transform`, `opacity`
- **FROM → TO:** `scale(1)→scale(.985)`; opacity `1→.92`
- **DURATION_MS:** 110
- **EASING:** `cubic-bezier(.4,0,.2,1)`
- **DELAY:** 0
- **INTERRUPTIBILITY:** release reverses immediately
- **REDUCED_MOTION:** transform disabled; outline/filled-state change remains

## M-04 — DROPZONE_ARM
- **MOTION_ID:** M-04
- **PURPOSE:** Feedback
- **TARGET:** CHECKER drop target + entry segment of Evidence Spine
- **TRIGGER:** `dragenter` / `dragleave`
- **PROPERTIES:** `opacity`, `transform`
- **FROM → TO:** inner mark `scale(.98)→1`; entry line opacity `.45→1`
- **DURATION_MS:** 160
- **EASING:** `cubic-bezier(.2,.8,.2,1)`
- **DELAY:** 0
- **INTERRUPTIBILITY:** dragleave reverses
- **REDUCED_MOTION:** no transform; border + copy changes only

## M-05 — FILE_SELECTED
- **MOTION_ID:** M-05
- **PURPOSE:** State Transition
- **TARGET:** file preview + file facts
- **TRIGGER:** valid file accepted
- **PROPERTIES:** `opacity`, `transform`
- **FROM → TO:** preview `opacity 0 / translateY(6px)` → `1 / 0`
- **DURATION_MS:** 180
- **EASING:** `cubic-bezier(.2,.8,.2,1)`
- **DELAY:** 0
- **INTERRUPTIBILITY:** selecting another file replaces without queued motion
- **REDUCED_MOTION:** appear immediately

## M-06 — ANALYSIS_WAIT_RAIL
- **MOTION_ID:** M-06
- **PURPOSE:** Feedback
- **TARGET:** 28px highlight segment on static Evidence Spine
- **TRIGGER:** metadata analysis active
- **PROPERTIES:** `transform`
- **FROM → TO:** `translateY(0)` → `translateY(var(--rail-travel))`
- **DURATION_MS:** 1200 loop
- **EASING:** `linear`
- **DELAY:** 0
- **INTERRUPTIBILITY:** stops immediately when analysis resolves/errors
- **REDUCED_MOTION:** animation none; static rail + `解析中…` text. No infinite animation
- **IMPLEMENTATION NOTE:** CSS keyframes only; no JS frame loop

## M-07 — RESULT_REVEAL
- **MOTION_ID:** M-07
- **PURPOSE:** State Transition
- **TARGET:** verdict block, limits block, first evidence row
- **TRIGGER:** analysis result committed
- **PROPERTIES:** `opacity`, `transform`
- **FROM → TO:** `opacity 0 / translateY(8px)` → `1 / 0`
- **DURATION_MS:** 220
- **EASING:** `cubic-bezier(.2,.8,.2,1)`
- **DELAY:** verdict 0; limits 35ms; evidence 70ms
- **INTERRUPTIBILITY:** new file selection cancels all
- **REDUCED_MOTION:** all blocks visible immediately; semantic order unchanged

## M-08 — ERROR_REVEAL
- **MOTION_ID:** M-08
- **PURPOSE:** State Transition
- **TARGET:** error dossier
- **TRIGGER:** validation/analysis/pixel error
- **PROPERTIES:** `opacity`
- **FROM → TO:** `.2→1`
- **DURATION_MS:** 160
- **EASING:** `cubic-bezier(.4,0,.2,1)`
- **DELAY:** 0
- **INTERRUPTIBILITY:** dismiss/retry immediate
- **REDUCED_MOTION:** immediate
- **RULE:** no shake

## M-09 — PIXEL_DOWNLOAD_PROGRESS
- **MOTION_ID:** M-09
- **PURPOSE:** Feedback
- **TARGET:** native/progress-like rail fill + byte count
- **TRIGGER:** model download active
- **PROPERTIES:** rail fill uses `transform: scaleX()`; numeric text updated by existing JS
- **FROM → TO:** `scaleX(0)→scaleX(progress)`
- **DURATION_MS:** 120 per progress update
- **EASING:** `linear`
- **DELAY:** 0
- **INTERRUPTIBILITY:** failure stops immediately
- **REDUCED_MOTION:** transition none; numeric bytes remain

## M-10 — PIXEL_RESULT_SEAL
- **MOTION_ID:** M-10
- **PURPOSE:** State Transition
- **TARGET:** small LAB result seal/glyph
- **TRIGGER:** inference result ready
- **PROPERTIES:** `opacity`, `transform`
- **FROM → TO:** `0 / scale(.92)` → `1 / scale(1)`
- **DURATION_MS:** 180
- **EASING:** `cubic-bezier(.2,.8,.2,1)`
- **DELAY:** 0
- **INTERRUPTIBILITY:** rerun cancels
- **REDUCED_MOTION:** immediate

## M-11 — AIC_SCORE_UPDATE
- **MOTION_ID:** M-11
- **PURPOSE:** Feedback
- **TARGET:** Score Docket numeric value / band label
- **TRIGGER:** checkbox state changes
- **PROPERTIES:** `opacity`, `transform`
- **FROM → TO:** old value `1 / 0` → `.0 / translateY(-4px)`; new value `.0 / translateY(4px)` → `1 / 0`
- **DURATION_MS:** 140
- **EASING:** `cubic-bezier(.4,0,.2,1)`
- **DELAY:** 0
- **INTERRUPTIBILITY:** rapid changes collapse to latest value; no queue
- **REDUCED_MOTION:** numeric text updates instantly

## M-12 — COPY_SUCCESS
- **MOTION_ID:** M-12
- **PURPOSE:** Feedback
- **TARGET:** copy buttons in BADGE / AICHECK
- **TRIGGER:** copy succeeds
- **PROPERTIES:** `opacity`
- **FROM → TO:** label crossfade to `コピーしました ✓`
- **DURATION_MS:** 120 in / 120 out after approx 2s
- **EASING:** `linear`
- **DELAY:** revert ~2000ms
- **INTERRUPTIBILITY:** repeated copy restarts timer
- **REDUCED_MOTION:** label changes without fade

## M-13 — BADGE_GENERATED
- **MOTION_ID:** M-13
- **PURPOSE:** State Transition
- **TARGET:** generated proof preview + `最後の封印` block
- **TRIGGER:** valid generation complete
- **PROPERTIES:** `opacity`, `transform`
- **FROM → TO:** `0 / translateY(8px)` → `1 / 0`
- **DURATION_MS:** 220
- **EASING:** `cubic-bezier(.2,.8,.2,1)`
- **DELAY:** preview 0; final-step 60ms
- **INTERRUPTIBILITY:** regenerate cancels/restarts
- **REDUCED_MOTION:** immediate

## M-14 — CREATOR_FILTER
- **MOTION_ID:** M-14
- **PURPOSE:** State Transition
- **TARGET:** creator list result region
- **TRIGGER:** keyword/genre changes
- **PROPERTIES:** `opacity`
- **FROM → TO:** `.65→1`
- **DURATION_MS:** 120
- **EASING:** `linear`
- **DELAY:** 0
- **INTERRUPTIBILITY:** always latest filter state
- **REDUCED_MOTION:** transition none

## M-15 — DOCUMENT_ANCHOR_FOCUS
- **MOTION_ID:** M-15
- **PURPOSE:** Feedback
- **TARGET:** destination heading after TOC anchor navigation
- **TRIGGER:** anchor navigation completes
- **PROPERTIES:** `opacity` of a pseudo-element index mark only
- **FROM → TO:** `.0→1→.0`
- **DURATION_MS:** 400 total
- **EASING:** `linear`
- **DELAY:** 0
- **INTERRUPTIBILITY:** new navigation replaces
- **REDUCED_MOTION:** no flash; `:target` static red index remains briefly via nonanimated style if desired

## prefers-reduced-motion global

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
  }
  .brand-motion,
  .state-motion,
  .wait-rail__highlight {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}
```

Do not disable functional progress values, focus rings, labels, or state text.
