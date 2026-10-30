# Energy-flow implementation — 2026-10-31

Scope: the owner accepted time-axis planning, reversible order comparisons, intent-based hints, and transition planning. This is a feature change, not a replacement of the owner-approved stage design. Keep its hero, navigation, palette, assets and storage schema. No new network services or dependencies.

Primary action: open the flow designer. Top tasks: inspect time distribution, compare a draft order, adopt or discard. Secondary controls: goal and MC toggles. Existing other-setlist comparison remains available on a common elapsed-time axis. Do not invent audience scores; use entered energy only.

A focused modal was selected over permanent controls in the narrow sidebar: it gives the timeline usable width while preserving the accepted reference. Uses existing M3-sized studio tokens, 44 px controls, native modal focus/escape handling. The original stage model remains the reference for the surrounding UI; this feature does not reopen the previously accepted overall design.

Empty: prompt to add songs. Missing duration: omit precise graph and identify incomplete totals. Local synchronous calculation: no artificial loading state. Offline: same functionality via service worker. Draft: isolated cloned entries; close/reset discards. Success: explicit adoption with existing undo. Conflict: compare source signature before adoption and refuse stale overwrite. Long names: text nodes and wrapping; no imported markup.

Pure model tests cover timing conservation, final MC/no final gap, unknown fields, repeated song occurrences and identity, tuning changes, goal hints and mutation isolation. Browser tests cover 360/390 widths at DPR3 in light/dark, draft/reset/discard/adopt/undo, offline, malicious names and missing timing. Run results are recorded after execution; this document alone is not a pass assertion.

Deferred: song-personality tags and rehearsal feedback as agreed; physical-phone acceptance; public main deployment. Recorded/imported audio wording corrected to distinguish persisted recordings from temporary imported audio.

Verification: pure Node checks 26/26 and three deliberate diagnosis mutations detected. Final flow browser run exercised 4 viewport/scheme combinations, draft/reset/discard/adopt/undo/offline, malicious title and missing timing successfully. Existing smoke/torture/studio suites rerun on the isolated Windows checkout. Main-screen uicheck GREEN (360/390 DPR3, light/dark): hard failures 0, small targets 0, detected low contrast 0; font sizes 8 -> 6 versus the previous studio baseline, radii 3 -> 3. Image/gradient contrast remains partly unmeasured (62 unknown cases). Modal tap height, select font size and horizontal overflow additionally asserted in flow browser tests. Physical phone and aesthetic acceptance remain unverified.

Test-environment repairs: waited for the existing 150 ms save debounce instead of inspecting storage immediately. Synced the QR license file missing from the isolated test checkout, which had prevented service-worker installation. Added finite service-worker readiness timeout. These failures were not counted as successful runs.
