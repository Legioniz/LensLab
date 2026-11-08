# LENS LAB 0.5.0 — Verification report

## Frontend changes included in 0.5.0

- Versioned `theme` and `soundVolume` preferences are backward-compatible with existing preference records; missing fields use safe defaults.
- Theme changes are applied through the root `data-theme` attribute and `color-scheme`, while photo/viewfinder pixels remain untouched.
- Interface sound feedback is delegated from the application shell, with dedicated shutter success feedback and throttled slider ticks.
- The guided tour resets legacy full-screen backdrop/shadow styles, uses four dim panels around a transparent click-through target, and remeasures target coordinates on resize/scroll.
- Global reduced-motion and user animation-off states disable the added transitions.

## Checks completed in the packaging environment

- Archive integrity and SHA-256 checksum were verified after packaging.
- TypeScript/TSX source syntax scan completed without syntax diagnostics.
- Relative local-import resolution scan completed without unresolved imports.
- Strict TypeScript check passed for dependency-independent engine, worker, and camera/recipe modules.
- The 39 existing engine test cases passed in an isolated Node assertion harness that loaded the project test files; this is a local smoke harness, not the official Vitest runner. Three additional Vitest tests now cover all nine synthesized sound cues, disabled/muted behavior, and the unsupported-Web-Audio fallback. Their equivalent runtime smoke path passed, but the official Vitest runner remains pending until dependencies are installed.
- Runtime regression checks passed for mask crop mapping across different resolutions, invalid mask dimensions, 90-degree output geometry, and original-layer crop alignment.
- Existing engine smoke checks for exposure math, photo-analysis helpers, recipes, lens calculations, and ZIP writing remain applicable.
- `bash -n scripts/install.sh` passed.

## Windows user-reported verification history

- The 0.4.0 Windows run passed TypeScript but had one recipe-parser assertion mismatch; 35 of 36 tests passed and the production build was not reached.
- Version 0.4.1 corrected the message and the PowerShell 5.1 lockfile/server-detection issues.
- Version 0.4.2 addresses additional Photo Lab rendering and stale-result defects found during source review.

## Remaining target-machine checks

The full dependency-backed `npm run verify` (React/TypeScript semantic check, complete Vitest suite, and Vite production build), Windows PowerShell 5.1 launcher execution, and live Chrome/Edge interaction checks still need to be run on a machine with the project's exact npm dependencies installed. The packaging environment did not have the full React/Vite/Vitest dependency tree available, and registry access was not reliable. Do not treat the release as fully certified until those checks pass.

## Manual browser regression checklist

1. Load a 6000 × 4000 photograph and a 1500 × 1000 subject mask. Apply crop and 90-degree rotation, then increase background blur. The subject boundary should remain aligned.
2. Use before/after wipe after cropping and rotating. Both layers should retain identical framing and dimensions.
3. Quickly replace one photograph with another while metadata and fingerprint calculation are pending. Only the current photograph's results should appear.
4. Rapidly move an adjustment slider while worker previews are pending. The final visible preview and histogram should reflect the latest settings.
5. Clear a mask or replace the photograph while a mask file is decoding. The old mask must not reappear.


## Manual frontend demo checklist

1. Switch Light Studio ↔ Dark Studio from the top bar and Settings. Inspect every workspace: Studio, Photo Lab, Lens Compare, Presets, Gallery, Analysis, Academy, Settings, Diagnostics, and modal dialogs. Confirm form values and small metadata labels remain readable.
2. Enable sounds, adjust volume to 20%, 50%, and 100%, and test navigation, switches, selectors, sliders, focus, shutter, success, warning, and mute. Confirm slider sounds do not chatter during fast drags and that browser audio restrictions never block a control.
3. Disable animations in Settings and enable the operating system's reduced-motion setting. Verify page transitions, tour breathing, and hover movement stop without removing state feedback or focus indicators.
4. Start and replay the guide. Test first-run, next, skip, close, Escape, viewport resize, mobile layout, and targets near the top/bottom edges. Confirm unrelated controls dim, the active target remains clear and clickable, and keyboard focus remains inside the tour.
5. Test at 320 px, 420 px, 760 px, 1024 px, and 1440 px viewport widths. Check top-bar actions, sidebar toggle, settings theme cards, Photo Lab toolbar/inspector, tour card, and modal stacking for overlap or horizontal scrolling.
