# Changelog


## 0.5.1 — Real-photo practice library

- Added a dedicated Photo Practice workspace with five online reference photographs for each of the five built-in simulator scenes: portraits, landscapes, night scenes, action and motion, and food/products.
- Added creator/source credits, direct source-page links, difficulty labels, and concise exercise prompts that train exposure, focus, motion, composition, and lighting decisions.
- Added scene-level learning objectives and suggested camera-setting starting ranges; these are clearly labeled as practice guidance, not original photo EXIF.
- Added image-load fallbacks, Escape-to-close for the photo detail dialog, and a matching-simulator action. The rest of the local app continues to work when photo hosting is unavailable.
- Added `PHOTO-PRACTICE.md` with the source credits, original photo links, and license/hosting notes.
- Added a guided-tour step for the new Photo Practice workspace.


## 0.5.0 — Frontend, themes, sound, and guided interaction

- Added persistent light and dark workspace themes with shared contrast, surface, border, and focus tokens across application chrome, cards, controls, forms, diagnostics, and modals. The camera viewfinder and photo pixels remain unmodified by theme styling.
- Replaced the single-tone sound utility with a local Web Audio sound palette: click, navigation, toggle, slider, focus, shutter, success, warning, and error. Added persisted master volume; mute and volume controls never block workflows.
- Added global event-delegated sound feedback, covering controls in the main app and child workspaces without embedding audio files or adding dependencies. Slider feedback is throttled to avoid noise during continuous adjustment.
- Added restrained page/panel transitions, hover and active feedback, guided highlight breathing, and full support for the app's animation preference and OS reduced-motion setting.
- Reworked the visual tour to use a clear, click-through spotlight window surrounded by dimming panels, measured responsive placement, scroll-safe target positioning, progress, Escape dismissal, focus management, and manual replay from Settings.
- Added a top-bar theme switch, Settings theme cards, a sound-volume control, and a replayable walkthrough.
- Added frontend design and demo documentation plus a `npm run demo` command that builds and serves the production preview locally.

## 0.4.2 — Photo Lab reliability hotfix

- Fixed subject-mask sampling when the mask resolution differs from the photograph resolution; crop coordinates now map through normalized image space.
- Fixed before/after comparison alignment by rendering the original layer with the same crop, quarter-turn rotation, output dimensions, and preview scaling as the edited layer.
- Prevented stale EXIF and SHA-256 results from a previously selected photograph from replacing the active photograph's metadata.
- Prevented asynchronous worker previews from drawing out of order over the visible canvas; each render now works on isolated canvases and only the latest request may commit.
- Invalidated delayed subject-mask decodes when the active photo changes or a mask is cleared.
- Added regression tests for mask-coordinate mapping, invalid geometry inputs, and rotated preview dimensions.
- Corrected README release labels so the 0.4.0 feature set is not described as newly introduced in 0.4.1.

## 0.4.1 — Verification and Windows launcher hotfix

- Corrected the recipe-validation error wording so invalid positive-only camera values produce the expected, clear validation message.
- Fixed lockfile version inspection on Windows PowerShell 5.1 by using the already-required Node.js runtime to parse npm lockfiles; avoids treating the empty root-package key as a parse failure and triggering unnecessary reinstalls.
- Made existing-server detection compare against the current package version instead of a stale 0.3.0 value.

## 0.4.0 — Compact workspace and shot recipes

- Reworked Photo Lab into a compact, viewport-fitted editing workspace with a centered image stage, compact inspector, zoom and drag-to-pan controls, original/edited/wipe comparison, and a pointer-draggable before/after divider.
- Added independently collapsible navigation and inspector panels; the navigation preference is persisted locally and the collapsed sidebar retains a visible `>` reopen handle.
- Added Photo Lab exposure compensation in EV, undo/redo for image adjustments, and bounded full-resolution JPEG export up to 24 MP. Larger photographs are resized with an explicit status message to limit browser memory pressure.
- Added shot recipes in a dedicated IndexedDB store with session-memory fallback, validated `.lensrecipe.txt` import/export, immutable revisions, revision restore, apply, delete, and update operations.
- Upgraded the IndexedDB schema to version 3.
- Improved Windows dependency repair so a stale lockfile from the previous application version is reconciled with `npm install` rather than incorrectly forcing `npm ci`.
- Added recipe parser/revision tests and exposure-adjustment tests.
- Kept original uploaded photographs untouched. Depth and motion effects remain illustrative approximations when no scene depth or motion data exists.
- Added local EXIF extraction for JPEG, PNG, and WebP, plus a live RGB/luminance histogram of the rendered preview.
- Added an OffscreenCanvas worker preview path with automatic main-thread Canvas fallback.
- Added user-supplied grayscale subject masks for depth-aware background blur, SHA-256 source fingerprints, crop/quarter-turn rotation, vibrance, tint, and sharpening.
- Added batch export for up to 20 photographs in one ZIP archive, with a 150 MB output cap and a settings manifest.
- Added a dedicated Lens Comparison workspace with field-of-view, variable-zoom maximum-aperture, and depth-of-field estimates.
- Preserved compatibility with older recipe files by defaulting newly introduced adjustment fields.
- Dependency-backed type checking, Vitest execution, production build, and real-browser testing remain pending because npm registry access was unavailable in the packaging environment.

## 0.2.2 — TypeScript CSS import hotfix

- Added an ambient CSS module declaration so strict TypeScript side-effect import checking recognizes Vite-managed stylesheets.
- Removed the duplicate global stylesheet import from `App.tsx`; `main.tsx` remains the single stylesheet entry point.
- Updated the project, launcher, and documentation release identifiers.

## 0.2.1 — Photo Lab and workflow release

- Added local JPEG/PNG/WebP import, side-by-side compare, camera-setting experiments, image adjustments, JPEG export and Gallery save.
- Added text-based `.lenspreset.txt` CRUD with immutable local revisions, import/export and restore-as-new-version.
- Added a first-run visual tour with highlights, arrows, next/skip/finish behavior and persisted completion/dismissal.
- Added searchable browser diagnostics, downloadable `.log` output, a React error boundary and a Windows launcher transcript/server log.
- Consolidated Windows setup/launch into `LENS-LAB.cmd`; checks runtime, npm, direct dependencies, type checking, tests, build, and local port before launch.
- Improved memory fallback so persisted image Blobs are not retained redundantly in memory; session-only fallback is used when storage fails.
- Added a starter preset file and complete user/feature documentation.

## 0.1.0 — Initial local simulator

- Initial camera settings studio, scene illustrations, EV100/depth-of-field logic, basic capture gallery and local-first application shell.

