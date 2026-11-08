# LENS LAB 0.4.0 — User and Feature Guide

## 1. What LENS LAB does

LENS LAB is a local-first photography practice studio. It provides a camera-settings simulator, image-based scene studies, a Photo Lab for personal photographs, a versioned preset library, a capture gallery, analysis tools, lessons, and diagnostics. Image processing happens in the browser; imported photographs are not uploaded to a LENS LAB server.

This software is an educational simulator. It is not a tethered camera controller, RAW developer, full optical ray tracer, or exact manufacturer JPEG pipeline.

## 2. Start the application

### Windows — recommended single-launch workflow

1. Extract the complete ZIP archive to a normal writable folder (for example, `Documents\LENS LAB`). Do not run it from inside the ZIP preview.
2. Double-click **`LENS-LAB.cmd`**. This is the only file a Windows user needs to launch manually.
3. The launcher checks Windows, project files, available disk space, Node.js, npm, dependencies, code checks, tests, and production build. Valid installed prerequisites are skipped.
4. If Node.js is missing or unsupported, the launcher first tries Windows Package Manager and then the official Node.js LTS MSI. The MSI's SHA-256 is checked against the checksum file published on `nodejs.org` before installation. Windows may show an administrator approval prompt.
5. When all checks pass, it starts the optimized production preview server, opens the browser, and prints `DONE PROCESSING` in the launcher window.
6. Keep the launcher window open while using the application. Press Enter in that window to stop a server started by this launcher. If it reuses an existing LENS LAB server, closing the launcher leaves that existing server running.

The first setup needs an internet connection to install missing runtime/dependencies. Later launches skip compatible Node/npm and complete npm dependencies. The launcher still runs type checks, tests, and a production build so changes or damaged installations are caught before launch.

### macOS / Linux

Install a supported Node.js LTS runtime (22.12+, 24.x, or 26.x LTS) and npm. Open a terminal in the extracted folder and run:

```bash
bash scripts/install.sh
```

Then open `http://127.0.0.1:4173` in a browser. The Windows one-click launcher is not intended for macOS/Linux.

## 3. First-run visual guide

The first-run guide dims the interface, highlights one interface area at a time, draws a directional arrow, and explains the control and a suggested action. It covers:

1. Studio viewfinder.
2. Exposure controls.
3. Scene library.
4. Photo Lab upload.
5. Preset library.
6. Gallery.
7. Academy.
8. Performance and diagnostics.

Choose **Next** to continue. Choose **Finish guide** to complete it. Choose **Skip guide** or the close (X) control to dismiss it. Both completion and dismissal are saved in browser LocalStorage. LENS LAB will not automatically show the guide again after either action. The application does not repeatedly prompt the user. This release does not include a forced replay prompt; the Academy and this document remain available as references.

The Windows launcher remembers its selected local port in `logs/app-port.txt` and tries that port first on later launches, which helps keep preferences and IndexedDB data attached to the same browser origin. If another application occupies that port, the launcher selects another available one; the browser treats a different port as a separate local origin.

If browser storage is blocked or cleared, the preference cannot be persisted by the browser. In that case the guide may appear again in a new browser session. The app records the storage limitation in diagnostics when possible.

## 4. Studio — camera simulator

### Camera and lens profiles

The first profile is a Canon EOS 3000D reference body with an illustrative generic zoom lens. Additional generic APS-C and full-frame bodies and illustrative lenses are supplied. A profile is a data definition, not a claim that every third-party lens or manufacturer behavior is reproduced exactly.

Select a camera and a compatible lens. Lens range, minimum/maximum aperture, focus distance and camera-body limits are used to validate controls. If a setting is outside the active profile limits, the application clamps or rejects it rather than silently using an impossible value.

### Exposure controls

- **Aperture (f-number):** Controls the modeled lens opening and depth-of-field estimate. Lower f-numbers mean a wider opening.
- **Shutter speed:** Controls exposure duration and the motion-response approximation. Faster shutter speeds use shorter exposure times.
- **ISO:** Controls the modeled exposure sensitivity and approximate noise strength.
- **Focal length:** Changes the framing and depth-of-field calculation.
- **Focus distance:** Sets the focus distance used by the optical calculations.
- **Exposure compensation:** Changes the target exposure for automatic modes and the meter reference; it does not directly rewrite the exposure triangle values in Manual mode.
- **Focus mode:** AF-S, AF-C, and MF are represented as learning controls; they are not connected to a physical autofocus motor.

### Shooting modes

- **M:** User controls aperture, shutter speed, and ISO.
- **Av:** User controls aperture and ISO; the simulator solves shutter time against the scene target.
- **Tv:** User controls shutter speed and ISO; the simulator solves aperture within lens limits.
- **P:** The simulator chooses a practical aperture bias based on the scene motion hint and solves shutter speed.

If an automatic solution hits a camera/lens limit, the exposure may remain away from zero. This is intentional and indicates that the settings cannot fully satisfy the target inside the profile's supported range.

### Scenes and capture

Choose a portrait, landscape, night, action, or product scene. Scene metadata includes a target EV100, suggested settings, focus distance, and motion hint. Press the on-screen shutter control or Space while focused outside a form/control to make a simulated JPEG capture. The capture and settings metadata are stored locally when IndexedDB is available.

## 5. Photo Lab — test your own photographs

### Import

Open **Photo Lab** and browse or drag a local JPEG, PNG, or WebP photograph into the upload area.

Current safety limits:

- Supported MIME types: JPEG, PNG, WebP.
- Maximum file size: 30 MB.
- Maximum decoded image size: 50 megapixels.
- The image is decoded locally with a temporary browser object URL.
- The original file is never overwritten or uploaded to a remote service.

If a photo fails to decode, export it from another editor as a standard JPEG, PNG, or WebP and import again.

### Compare and adjust

Photo Lab shows the unchanged original next to a simulated result, with a result-only view available. The exposure baseline is the camera setting active when the photo was imported. Ordinary image import does not assume or read complete EXIF exposure data; users may choose **Set baseline** to mark the current settings as neutral.

Available effects:

- Aperture changes the relative exposure calculation. The separate Focus softness control adds global blur; it is not selective depth-of-field or optical bokeh because no depth map is inferred.
- Shutter speed (a subtle global directional smear relative to the chosen baseline; no motion vectors are inferred).
- ISO (a deterministic luminance-like noise overlay).
- Contrast, saturation, and warmth (finishing adjustments).
- Eco, Balanced, and High preview quality (different maximum preview dimensions). Exports use the active preview quality and may be smaller than the original full-resolution upload. Transparent PNG areas are flattened onto white for JPEG output.

Use **Reset effects** to reset the visual adjustments. Use **Set baseline** to reset the camera settings reference. These actions do not change the original photo.

### Export and Gallery

- **Export JPEG** downloads a processed JPEG copy.
- **Save to Gallery** stores the processed JPEG in the local capture gallery with camera settings metadata.
- **Save camera settings as preset** opens the preset workflow for repeatable camera settings.

The export is a rendered JPEG, not RAW/DNG. It uses the selected preview-quality dimensions rather than preserving the original's full resolution. Color management and metadata are browser-dependent. Effects are educational approximations; the same sliders do not replicate a physical lens or the exact behavior of a particular camera sensor.

## 6. Presets — text files and version history

A preset is a camera configuration, not an image. It contains the name, description, schema version, preset version, camera profile ID, lens profile ID, shooting mode, scene ID, and the selected camera settings.

### Create / Read / Update / Delete

- **Create:** Enter a name and optional description. Create Preset saves the current configuration and downloads a readable `.lenspreset.txt` file.
- **Read / Load:** Select a saved entry to inspect it. Load into Studio applies its camera, lens, scene, mode, and compatible settings.
- **Update:** Load the selected preset into Studio, adjust camera settings, return to Presets, edit its name/description if needed, then choose Save New Revision. Existing versions remain in history; each new revision is also downloaded as a TXT snapshot.
- **Delete:** Delete the selected preset and its local revision history. Previously exported TXT files remain on disk.

### Version history

Each update creates a new immutable version snapshot. Users can export any prior version or restore it. Restore creates a new latest revision based on the old snapshot; it does not erase the intervening history.

### Import / Export

The text format includes a human-readable header and a structured JSON payload. Import validates the file's format, supported schema version, settings, and required profile/scene IDs before adding it as a new local preset. Imported files receive a new local ID and start at version 1 to avoid overwriting an existing record or history.

Files are downloaded by the browser; LENS LAB does not silently write to arbitrary folders. Users can keep a folder of `.lenspreset.txt` files in their own Documents directory or version-control them with Git if desired.

## 7. Gallery

The Gallery stores simulated Studio captures and Photo Lab exports. A capture record includes its image blob, date, scene, camera/lens profile identifiers and names, aperture, shutter, ISO, focal length, focus distance, EV100, exposure offset, and render quality.

Use capture details to review settings and use Download to save an image outside the browser. Delete removes the local capture. The browser's IndexedDB quota is finite; export important photographs and keep backups.

## 8. Analysis

The Analysis workspace provides exposure and image-reading support including a luminance histogram and exposure status. A histogram's left side represents darker pixels and its right side represents brighter pixels. A histogram is not a quality score: interpret it in relation to the scene and creative intent. Extreme left/right accumulation can indicate shadow/highlight clipping.

## 9. Academy

Academy lessons introduce the exposure triangle, aperture/depth of field, shutter/motion, ISO/image quality, and histogram interpretation. Each lesson includes a short experiment to perform in Studio. Completion state is stored locally in browser preferences.

## 10. Settings, appearance, sound, and accessibility

- **Workspace theme:** select Light Studio or Dark Studio in Settings → Workspace appearance. The top-bar sun/moon button is a quick switch. The selection persists locally and updates the application panels, controls, forms, cards, and overlays together. Photograph pixels and the simulated viewfinder are intentionally not inverted or recolored.
- **Sound effects:** enable or mute the local synthesized sound palette. Navigation, toggles, slider ticks, focus, confirmation, warning, and shutter actions use distinct short cues. Adjust Master Sound Volume from 0–100%. Sounds are generated with Web Audio; no external audio files or network requests are used. Browser audio may require a user interaction before playback.
- **Animation:** enables/disables optional interface motion. Transitions are limited to short entrances and control feedback rather than continuous movement. The operating system's reduced-motion preference is also respected.
- **Eco / Balanced / High:** reduces or increases image preview processing quality.
- **Grid and hints:** controls the rule-of-thirds overlay and contextual Studio field notes.

The first-run visual guide dims surrounding interface areas and leaves a clear, click-through spotlight around the active element. Its card is positioned above or below the target where space allows, scrolls targets below sticky navigation on shorter screens, includes progress, traps keyboard focus, and closes with Escape. It does not automatically reappear after completion or dismissal. Replay it from Settings → Guided walkthrough, press `?` anywhere outside an input, or use the top-bar help button to open Academy lessons. On narrow screens, the highlighted target is scrolled into view and the instruction card is clamped inside the viewport.

## 11. Diagnostics and logs

Open **Settings → Diagnostics and process log** to search messages, filter Info/Warning/Error, refresh records, export a `.log` file, or clear browser-side diagnostic history.

The browser stores diagnostic entries in IndexedDB when available. If IndexedDB is unavailable, log records are held in memory for the current browser session. JavaScript exceptions, unhandled promise rejections, capture failures, Photo Lab import/render/export issues, preset operations, and major startup events are logged where possible.

The Windows launcher creates:

- `logs/launcher.log` — prerequisite checks, install/skip decisions, npm dependency checks, verification output, launch status and fatal errors (PowerShell transcript).
- `logs/app-server.log` — Vite production-preview server output.

These files are plain text and can be searched with VS Code or Notepad. Logs may contain local file names and error paths; review them before sharing publicly.

## 12. Simulation theory and equations

### Exposure value

For aperture f-number `N`, shutter time `t` seconds, and ISO value `S`:

`EV100 = log2(N² / t) - log2(S / 100)`

LENS LAB compares the current `EV100` against the scene's target EV100. The rendered exposure response uses their difference. Positive exposure offset means brighter than the scene reference; negative means darker. Meter offset additionally accounts for exposure compensation.

### Exposure stops

A one-stop change doubles or halves the light/exposure quantity. Examples: ISO 100→200 is +1 stop; 1/250s→1/125s is +1 stop; f/4→approximately f/2.8 is +1 stop. Equivalent exposure can be maintained by balancing the controls, but depth of field, motion rendition, and noise do not remain identical.

### Depth of field

The hyperfocal distance approximation is `H = f²/(N·c) + f`, where focal length `f` and circle of confusion `c` use consistent length units. Near and far acceptable-focus distances are derived from hyperfocal distance and focus distance. The circle of confusion depends on the selected camera sensor profile and viewing assumptions.

### Rendering model

The image renderer applies bounded exposure/tone adjustments, blur approximations, noise and lens-effect overlays to source scene layers or uploaded photos. The renderer is an efficient 2D image pipeline. It does not perform photon simulation, ray tracing, full demosaicing, or camera-specific ISP emulation.

For mathematical definitions and implementation notes, see `docs/simulation-model.md` and `docs/architecture.md`.

## 13. Data, privacy, and fallback behavior

- No cloud account or backend is required.
- Imported Photo Lab images remain browser-local during editing.
- Captures/presets/logs use IndexedDB. If persistent browser storage fails, the app may keep new data in memory for the session and reports when the save is not persistent.
- Settings/preferences and onboarding status use LocalStorage with session-safe fallback where possible.
- Clearing site data, using a different browser/profile, or changing the local origin can make local data inaccessible.
- Export images and preset TXT files regularly. There is no automatic cloud backup.

## 14. Troubleshooting

| Symptom | What to do |
|---|---|
| Launcher says Node.js is missing | Confirm internet access, approve the installer prompt, or install Node.js LTS manually and launch again. |
| Dependency install fails | Check internet/proxy settings, then rerun `LENS-LAB.cmd`; inspect `logs/launcher.log`. |
| Tests or build fail | Read the first TypeScript/test error in the launcher window and the launcher log. Do not delete source files to silence the error. |
| Browser page does not open | Visit the URL printed by the launcher. Check `logs/app-server.log`; another port may have been selected. |
| Imported photo looks wrong | Use a standard JPEG/PNG/WebP export, smaller image dimensions, and Set baseline. |
| Capture/preset does not persist | Check browser site-storage permissions and available storage; export a copy. |
| Browser freezes on a large photo | Keep images below 30 MB and 50 MP; select Eco quality or prepare a smaller image. |
| Sound is silent | Click once inside the app and check the sound toggle and browser/tab mute setting. |

## 15. Known boundaries

- The bundled teaching scenes are authored illustration layers rather than stock photographs.
- Photo Lab does not yet read EXIF to infer the original exposure baseline.
- General uploads do not contain depth maps, subject segmentation or motion vectors; related effects are global approximations.
- Focus modes are learning controls, not real autofocus algorithms.
- Generic lenses and camera profiles are illustrative until specifications are verified against exact models.
- No USB/Wi-Fi/Bluetooth camera tethering is implemented.
- No RAW/DNG export is implemented.

## Photo Lab 0.4.0 compact workspace

Photo Lab now uses a compact editing workspace. The photograph is centered in the main stage; editing controls live in a narrow inspector on the right. The workspace is fitted to the available desktop viewport so the image, view selector, and primary controls remain visible without scrolling the whole page. The inspector may scroll internally if the screen is short.

The navigation sidebar and the Photo Lab inspector can be hidden independently. Click the sidebar chevron to collapse it; when hidden, a `>` handle remains visible on the left edge to reopen it. Use the sliders icon in the Photo Lab header or the inspector chevron to show/hide editing controls. The sidebar preference is remembered locally.

Use **WIPE** to drag a before/after divider across the photograph. **ORIGINAL** shows the untouched upload, and **EDITED** shows the current rendering. Zoom controls adjust the view only; when zoomed above 100%, drag the image to pan. Neither zoom nor pan crops the saved image.

The current Photo Lab image controls are exposure EV, contrast, saturation, global focus softness, and warmth, plus camera-response aperture, shutter speed, and ISO. Undo/redo tracks image-adjustment gestures. Reset Adjustments restores neutral image effects.

## Shot recipes

A shot recipe saves the current camera settings and Photo Lab adjustments for the imported image. Select **SAVE NEW** to name a recipe. Select an existing recipe and use **NEW REVISION** to store the current setup as the next revision. Use **APPLY** to reuse a recipe, **TXT** to export it as `.lensrecipe.txt`, or **IMPORT TXT RECIPE** to import a portable recipe. The history panel lets you restore an earlier revision as a new revision. The exported TXT bundle includes up to 50 immutable settings snapshots, so the revision history can travel with the recipe. Delete asks for confirmation.

The recipe file does not contain the photograph. It contains settings and basic source-image information only. Recipe imports are validated before being stored. If the recipe's source filename or dimensions differ from the current photo, LENS LAB asks before applying it.

## Photo Lab export limits

The preview is lower resolution for responsiveness. Export renders from the original decoded photograph, but is capped at 24 megapixels to control browser memory. Larger images are resized proportionally and the status message tells you the actual exported dimensions. Current export format is JPEG. Depth blur and motion are global visual approximations without depth maps or motion data.


## Photo Lab analysis and batch tools (0.4.0)

- The Image Analysis inspector reads available EXIF fields and shows live RGB and luminance histograms of the edited preview.
- SHA-256 fingerprints identify the exact source file when Web Crypto is available. Recipes can use this fingerprint to warn before applying settings to a different photograph.
- Geometry & Color contains quarter-turn rotation, proportional edge crop, vibrance, tint, and sharpening.
- Depth Mask accepts a grayscale mask matching the photograph's aspect ratio; its pixel resolution may differ. White retains the sharp subject; black receives background blur. This is not automatic AI selection.
- Batch Process accepts up to 20 images and exports processed JPEGs in a single ZIP archive. The archive has a 150 MB safety cap.
- The Lens Compare item in the sidebar compares two lens profiles using field-of-view and depth-of-field estimates based on the selected camera sensor.
