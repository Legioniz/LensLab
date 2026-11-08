# LENS LAB — Architecture

## Product boundary

LENS LAB is a local-first photography simulator and teaching tool. The current build is a browser application served from loopback. It does not require cloud services, sign-in, telemetry, external fonts, remote scene images, or API keys.

## Layered design

1. **Presentation:** React pages, reusable controls, viewfinder and charts.
2. **Application state:** Zustand holds current camera settings, selected profiles, scene, preferences, and the in-memory capture list.
3. **Domain/simulation:** pure camera and exposure functions. This layer does not depend on React, browser storage, or Canvas rendering.
4. **Rendering:** Canvas 2D pipeline reads bundled scene assets and applies simplified exposure/optical/sensor effects.
5. **Persistence:** native IndexedDB stores JPEG Blob data and capture metadata. LocalStorage holds small preferences and lesson progress.

The simulation modules should remain independent of the presentation and persistence layers. UI changes must not change the equations or database schema implicitly.

## Current module boundaries

- `src/engine/cameraProfiles.ts`: camera/lens profile data and structural validation.
- `src/engine/exposure.ts`: EV100, meter offset, hyperfocal/DOF estimate, and priority-mode solvers.
- `src/engine/scenes.ts`: scene metadata, exposure reference values, and bundled asset references.
- `src/engine/renderScene.ts`: asynchronous asset loading, Canvas 2D rendering, capture JPEG encoding.
- `src/components/SceneCanvas.tsx`: React viewfinder lifecycle and render scheduling.
- `src/storage/database.ts`: IndexedDB open/read/write/delete/clear functions.
- `src/store/cameraStore.ts`: shared application settings and transient capture state.
- `src/utils/sound.ts`: synthesized UI sounds via Web Audio; no downloaded audio files.

## Data flow

Camera control → validated Zustand state → pure simulation calculations → scene renderer → viewfinder. When the user captures, the renderer creates a JPEG Blob; the capture controller saves it through IndexedDB and adds a preview URL to the in-memory gallery state.

## Performance choices

- No full 3D engine in the image-scene release.
- No large image-processing library dependency.
- Scene layers are local and cached after initial load.
- Noise textures are generated once per ISO bucket and reused.
- Viewfinder render quality is configurable (Eco/Balanced/High).
- Eligible Photo Lab previews use a module Web Worker and OffscreenCanvas when available; all worker setup and processing failures fall back to the main-thread Canvas renderer.
- Image Blobs are stored in IndexedDB rather than Base64 LocalStorage strings.
- The UI uses CSS transitions, with a global reduced-motion setting.

## Reliability rules

- Test domain equations independently.
- Validate camera profiles before depending on their limits.
- Keep capture metadata alongside the rendered image.
- Version IndexedDB schema changes and add migrations when fields/stores change.
- Keep camera and lens specifications in profile data, not hardcoded into view components.


## Capture metadata contract

Every saved capture records the camera profile ID, lens profile ID and labels, full camera settings, scene target EV100, calculated EV100, image exposure offset, exposure-compensation-adjusted meter offset, render quality, creation timestamp, and JPEG Blob. This keeps the capture understandable even when the user later switches profiles. The JSON manifest exports metadata; image files are downloaded separately from the Gallery.


## Photo Lab workspace and recipes (0.4.0)

Photo Lab is presented as a viewport-fitted editor. The global navigation sidebar and the Photo Lab inspector can be collapsed independently. Their visibility preferences are stored in LocalStorage. The central image stage uses contain-fit rendering to preserve aspect ratio; the comparison layer supports original, edited, and draggable wipe modes.

The processing core remains in `engine/photoLab.ts`, independent from the React editor. Preview rendering is capped by a quality-specific long edge. Export creates a temporary canvas from the original decoded image, applies the current state, and limits output to 24 megapixels to bound primary RGBA buffer size. Eligible ordinary previews use `workerRenderer.ts` and `photoProcessor.worker.ts` with OffscreenCanvas. Cropping, rotation, depth-mask compositing, full-resolution export, and unsupported browsers use the main-thread Canvas fallback. Preview and export remain separate operations.

Shot recipes are serialized as validated `.lensrecipe.txt` files. IndexedDB database version 3 adds a `photoRecipes` object store while preserving existing captures, presets, and logs. Recipe revisions are immutable snapshots, and restore creates a new revision instead of modifying history. Session-memory fallback is available if IndexedDB cannot be used, but it is not persistent.


## Photo analysis and batch tools (0.4.0)

- `src/engine/photoAnalysis.ts` reads common EXIF tags from JPEG APP1, PNG eXIf, and WebP EXIF chunks; computes SHA-256 fingerprints through Web Crypto; samples RGB/luminance histograms; and provides normalized crop geometry.
- `src/engine/workerRenderer.ts` manages a reusable module worker, task IDs, timeouts, and graceful fallback. `src/workers/photoProcessor.worker.ts` uses OffscreenCanvas for eligible preview renders.
- Depth-mask processing is local and user-supplied: a grayscale image with matching aspect ratio becomes the subject alpha mask. It is not automatic segmentation.
- `src/engine/zipStore.ts` builds a standards-compliant ZIP STORE archive without an added dependency. Batch processing validates inputs and enforces a 20-file / 150 MB output limit.
- `src/engine/lensMath.ts` isolates field-of-view, variable-aperture interpolation, and hyperfocal depth-of-field calculations from the React Lens Comparison page.
