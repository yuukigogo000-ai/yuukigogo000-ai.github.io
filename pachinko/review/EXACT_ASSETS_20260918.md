# Exact supplied launch artwork — 2026-09-18

Scope: title and difficulty selection only. Base: 452f9fe.

- Direct integer-coordinate crops of the supplied background, asset and component sheets.
- Title: the supplied main pachinko hall. Difficulty: the supplied green, gold and red scenes.
- No image regeneration and no full UI screenshots in the interface.
- Artwork remains lossless. Crown, gear and divider have the black sheet backing removed using alpha; RGB artwork is retained.
- Text, prices, selection state and buttons remain live HTML/CSS.
- All executable inline scripts and the entire document from `#app` onward are unchanged.
- Existing rule explanations and every difficulty route are retained.
- Cache metadata updated for the new images. Eleven obsolete startup asset references, already absent in the base, were removed so service worker installation succeeds. Install/activate/fetch handlers are unchanged.

Validation:
- 249 assertions passed across Chromium and WebKit.
- Chromium viewports: 320x568, 360x800, 390x844, 430x932, 560x900 and 844x390. WebKit: 360x800 and 390x844.
- All four game-start routes, title/back, settings/help, no-save state, saved-game continue, save byte preservation, image provenance/hash/decode, touch targets, layout bounds and runtime resources checked.
- The scope guard was mutation-checked by injecting a changed game-start difficulty; it rejected the mutation.
- Offline title, difficulty, eight active image assets and existing-save continue passed in an isolated Chromium profile.
- Visual inspection corrected black sheet backings and scrolling content underneath the fixed heading.
- No real player profile or user save was opened by the tests.

The source sheet has finite resolution; artwork was not regenerated or AI-upscaled. Longer existing rule text is preserved and the difficulty screen scrolls.
