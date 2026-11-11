# LENS LAB 0.5.1

**Local-first photography simulation studio** — universal camera profiles, image-based teaching scenes, Photo Lab for personal photographs, versioned text presets, gallery, analysis, Academy, and local diagnostics.

## Windows quick start

1. Extract the complete ZIP to a writable folder.
2. Double-click **`LENS-LAB.cmd`**.
3. The launcher checks the system, skips compatible Node.js/npm, reconciles dependencies only when needed, generates a missing package lockfile, runs type checks/tests/build, starts the local app, opens the browser, and prints `DONE PROCESSING`.
4. Keep the launcher window open while the application is in use. Press Enter in that window to stop it. A small port file under `logs/` keeps the same browser origin on future launches whenever that port is available, helping local preferences and IndexedDB data stay in place.

The one-click launcher serves the optimized production build after verification. Use `npm run dev` only when actively developing the source. The first setup requires internet access if Node.js or npm dependencies are missing. The runtime installer uses the official Node.js LTS distribution and validates the MSI checksum. See [Installation](INSTALLATION.md).

## Features

- Studio: Manual, Aperture Priority, Shutter Priority and Program exposure modes.
- Photo Practice: 25 real-world reference photographs across the five simulator scenes, each with creator/source credit, a practical exercise, and suggested starting ranges. Images stream from Unsplash and show a fallback when unavailable.
- Universal camera body and lens profiles, with Canon EOS 3000D as the first reference profile; compare two lens profiles in the Lens Compare laboratory.
- Image-scene simulator with EV100 exposure, depth-of-field estimates, motion/noise/lens approximations and live histogram.
- Photo Lab: local JPEG/PNG/WebP import, non-destructive editing, crop/rotate/color tools, RGB histogram, EXIF metadata, SHA-256 identity, subject-mask background blur, undo/redo, batch ZIP export, and recipe versioning.
- Presets: create, inspect, update, import, export and delete `.lenspreset.txt` files with immutable revision history.
- Gallery: IndexedDB-backed captures and metadata.
- Academy: concise lessons and exercises.
- First-run visual guide: focused spotlight, dimmed surrounding interface, progress, keyboard dismissal, and step-by-step explanations. Completion/dismissal is remembered; users can replay the guide from Settings.
- Settings: persistent Light/Dark workspace themes, adjustable synthesized UI sounds, motion controls, accessibility-aware guides (`?` replays the walkthrough), and Eco/Balanced/High preview quality.
- Diagnostics: searchable browser logs plus Windows launcher and server log files.

## Requirements

- Windows 10/11 for the one-click launcher.
- Node.js 22.12+, 24.x, or 26.x LTS; npm.
- At least 1 GB free disk space for first installation and builds.
- Modern browser with Canvas and IndexedDB support.
- First install: internet connection if dependencies or Node.js are missing.

macOS/Linux users can install a supported Node.js LTS release and use `bash scripts/install.sh`.

## Developer commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run verify
npm run demo
```

`npm run demo` builds the optimized app and serves the production preview locally on port 4173. The Windows launcher prints the selected local URL (ports 5173–5190). The macOS/Linux preview defaults to `http://127.0.0.1:4173`; `npm run dev` uses `http://127.0.0.1:5173`.

## Documentation

- [User and feature guide](docs/USER-GUIDE.md)
- [Architecture](docs/architecture.md)
- [Simulation model](docs/simulation-model.md)
- [Camera profiles and scenes](docs/profiles-and-scenes.md)
- [Dependency and fallback policy](docs/DEPENDENCIES.md)
- [Verification report and test boundaries](docs/VERIFICATION.md)
- [Frontend experience and demo guide](docs/FRONTEND-UX.md)
- [Changelog](CHANGELOG.md)
- [Example preset](examples/portrait-soft-daylight.lenspreset.txt)
- [Installation guide](INSTALLATION.md)
- [Photo Practice photo credits, usage notes, and source links](PHOTO-PRACTICE.md)

## Important limitations

The included learning scenes are layered original illustrations. Photo Lab does not infer a complete exposure baseline from EXIF and cannot infer depth/motion data from ordinary photos. Uploaded-photo focus/motion effects are approximations. Exports are JPEG, not RAW/DNG; camera tethering is not implemented. See the user guide for the complete boundaries and troubleshooting instructions.

## Data and privacy

The app is local-first. Photo Lab does not upload your original photo. Captures, presets, and browser diagnostics are stored in IndexedDB; preferences and first-run guide state use LocalStorage. Browser site-data clearing can erase stored content. Export important photos and `.lenspreset.txt` presets regularly. Photo Practice loads its selected public reference images directly from Unsplash when that tab is opened; this sends normal image requests to Unsplash. Your imported Photo Lab originals, captures, presets, and settings are not uploaded to Unsplash.


## 0.5.1 photo practice library

- Added a dedicated Photo Practice workspace with five online reference photographs for each of the existing five simulator scenes.
- Added source/photographer credits, scene-specific learning objectives, per-photo exercises, difficulty labels, and suggested starting ranges that are explicitly not original EXIF.
- Added direct links to each source photo, image-load fallbacks, and a guided-tour step. The simulator remains usable when image hosting is unavailable.

## 0.5.0 frontend and interaction system

- Added coordinated Light Studio and Dark Studio themes. Theme choice is saved locally and applies to app surfaces, controls, form fields, overlays, and the workspace chrome while preserving photograph/viewfinder colors.
- Rebuilt interface sound as a small local Web Audio synthesizer with distinct navigation, toggle, slider, focus, confirmation, warning, and shutter cues, plus a persisted master volume and global mute. No audio assets or network calls are required.
- Added restrained page/panel entrance transitions, button feedback, and guided-spotlight breathing; app-level and OS reduced-motion settings disable motion.
- Added a true transparent guide window with surrounding dim panels, responsive tooltip placement, progress indication, Escape-to-dismiss, focus handling, and a replay control in Settings.
- Centralized sound dispatch at the application shell so buttons, navigation, switches, selectors, and range controls across the Studio, Photo Lab, Lens Compare, Presets, Gallery, Academy, and Diagnostics use consistent feedback.
- Added `docs/FRONTEND-UX.md` with the design system, sound map, guide behavior, and demo checklist.

## 0.4.2 reliability hotfix

- Scales subject-mask crop coordinates to the mask's own pixel dimensions, so lower-resolution masks stay aligned with full-resolution photographs.
- Renders the original comparison layer with the same crop, rotation, and preview geometry as the edited image.
- Guards EXIF and SHA-256 results with the active photo-load generation; delayed analysis from an earlier photo cannot overwrite the current photo's metadata.
- Uses private work canvases and sequence-checked commits for previews, preventing older worker jobs from overwriting newer edits.
- Adds regression tests for normalized mask mapping and quarter-turn preview geometry.

## 0.4.0 workspace improvements

Photo Lab now uses a compact viewport-fitted workspace. Its navigation sidebar can be collapsed and reopened with the visible chevron handle, while the editing inspector has an independent hide/show control. The image viewport supports original, edited, and draggable before/after wipe views, plus zoom and fit reset.

Photo Lab adjustments remain non-destructive. Shot recipes are saved locally in IndexedDB and can be exported or imported as readable `.lensrecipe.txt` bundles containing up to 50 immutable revision snapshots. Previous revisions can be restored as a new revision. The full-resolution export path is capped at 24 megapixels to bound memory use; larger images are resized and the status message reports the exported dimensions.

See `docs/PHOTO-LAB.md` for the editor layout, processing model, recipe format, and limitations. See `docs/USER-GUIDE.md` for using the application.


## 0.4.0 image analysis and optics tools

- Local EXIF reader for JPEG APP1, PNG eXIf, and WebP EXIF chunks. Only available fields are displayed; GPS is reported as present without exposing coordinates.
- Live RGB and luminance histograms sampled from the edited preview.
- Worker + OffscreenCanvas preview path with automatic main-thread Canvas fallback.
- Optional depth-aware background blur using a user-provided aligned grayscale subject mask (white = subject, black = background); no automatic segmentation is claimed.
- SHA-256 image fingerprints where Web Crypto is available; fingerprints can be embedded in portable shot recipes.
- Crop, quarter-turn rotation, vibrance, tint, and sharpening controls.
- Batch processing of up to 20 photos into one dependency-free ZIP archive, with a 150 MB output safety cap.
- Lens Comparison workspace for focal length, field-of-view, aperture-limit, and depth-of-field estimates.

See `docs/PHOTO-ANALYSIS.md` and `docs/LENS-COMPARISON.md` for limitations and usage.

## Repository hygiene

The repository tracks the application source and dependency lockfile, not local installations or generated output:

- `node_modules/` is recreated with `npm ci`.
- `dist/` is recreated by `npm run build`.
- `logs/` contains local launcher/server logs and the local port marker; it is not part of the application source.
- Local editor files, compiler metadata, and test output should remain untracked.

For a clean development setup, install the pinned dependencies and run the verification commands:

```bash
npm ci
npm run verify
```

Do not commit personal photographs, local captures, diagnostic logs, machine-specific paths, or credentials. Photo Lab content remains in the browser's local IndexedDB unless a user explicitly exports it.
