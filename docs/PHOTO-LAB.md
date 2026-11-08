# LENS LAB 0.4.0 — Photo Lab and Shot Recipes

## 1. Workspace layout

Photo Lab is a viewport-fitted editor. On desktop, the central image stage uses the available width while the inspector stays in a compact right column. The navigation sidebar is independent from the inspector.

- Click the sidebar's chevron handle to collapse navigation. When collapsed, the `>` handle remains visible at the left edge. Click it to reopen navigation.
- The sidebar's expanded/collapsed state is stored in LocalStorage under `lenslab-sidebar-collapsed-v1`.
- Use the sliders icon in the Photo Lab header to hide or show the inspector. The inspector can also be hidden from its own heading.
- Use the zoom minus/plus controls to zoom between 50% and 200%. At zoom levels above 100%, drag the photograph to pan; the original and edited layers move together. Click the percentage to return to Fit (100%) and reset the pan.
- Use Wipe to compare the original and simulated result with the divider, or select Original or Edited.
- The image is shown with `object-fit: contain`; its proportions are preserved.
- On narrow screens, the editing inspector moves below the image stage and remains independently scrollable.

## 2. Importing a photograph

Supported initial input formats are JPEG, JPG, PNG, and WebP. The initial limits are 30 MB per file and 50 megapixels. Files are decoded locally in the browser. LENS LAB does not upload them.

A file that exceeds a limit is rejected with an explanation. The source image is kept as a separate object URL/Image element and is not overwritten by the editing operations.

## 3. Available controls

### Camera response

Aperture, shutter speed, and ISO adjust a relative camera-response approximation. The import-time camera settings are used as the neutral baseline. LENS LAB does not assume that missing EXIF metadata can be reconstructed.

### Image adjustments

- Exposure: additional EV adjustment, bounded from -4 to +4 EV.
- Contrast: 0.60× to 1.60×.
- Saturation: 0.00× to 1.80×.
- Focus softness: 0 to 8 px of global blur.
- Warmth: -100 to +100, represented by a restrained color overlay.

Undo and redo are available for adjustment gestures. Reset Adjustments returns these image effects to their neutral values. It does not change the original source.

## 4. Preview and export

The live preview is downsampled according to the selected quality level: Eco, Balanced, or High. This keeps slider manipulation responsive and bounds preview memory use.

Export renders from the original decoded source and current settings into a temporary canvas. Export is capped at 24 megapixels to reduce the risk of exhausting browser memory. Images up to that limit retain their original pixel dimensions; larger images are scaled down proportionally. The status message reports the exported dimensions. Export is currently JPEG at quality 0.94.

If export fails, the error is shown in the interface and recorded in diagnostics. Temporary canvas resources are released after encoding.

## 5. Shot recipes

Recipes are saved in a dedicated IndexedDB `photoRecipes` store. The database schema was raised to version 3; existing capture and camera preset stores are retained during the upgrade.

A shot recipe records:

- Recipe identifier, name, description, revision, and timestamps.
- Source filename and dimensions.
- Camera settings at the time of saving.
- Photo Lab image adjustments.
- A short change history.

The internal record maintains immutable snapshots of the last 50 revisions. Each update creates a new revision. Restoring an earlier revision creates another new revision; it does not erase the intervening history.

### Supported operations

- Save New: create a recipe from current settings.
- New Revision: update the selected recipe with a new immutable snapshot.
- Apply: apply its camera and image adjustment settings. If the source filename or dimensions differ, the user is asked to confirm.
- TXT: export the current revision as a readable `.lensrecipe.txt` file.
- Import TXT: validate and import a recipe file. If its ID already exists, a new ID is generated to avoid overwriting the local recipe.
- Restore: create a new revision from one of the displayed older revisions.
- Delete: permanently delete a selected recipe and its local revision history after confirmation.

The text format has a `format` identifier and `schemaVersion`. A versioned `.lensrecipe.txt` export includes the current document and up to 50 immutable revision snapshots, so the history can travel with the file. The outer bundle is limited to 1 MB and each revision text is validated (maximum 256 KB) before saving. Revision snapshots retain the actual settings from each save, not only the human-readable change notes. Imports validate required camera settings, revision IDs, timestamps, and adjustment ranges. Older single-revision TXT files remain importable.

The recipe records source filename and image dimensions. This release does not yet create a cryptographic content fingerprint, so it cannot prove that two same-named, same-sized files have identical pixels.

If IndexedDB is unavailable, recipe operations use a session-memory fallback. That fallback is not persistent; export important recipes to TXT.

## 6. Accuracy and limitations

Photo Lab is an educational image-effects workspace, not a RAW developer or a physical optical ray tracer.

- It does not reconstruct a photograph's true 3D depth from a normal flat image.
- Focus softness is a global blur, not a depth-aware lens simulation.
- Motion is a global illustrative effect when no motion map exists.
- Camera-response settings are relative to the selected import baseline; they do not recover the original camera exposure automatically.
- This release does not parse EXIF metadata yet.
- This release exports processed JPEG images, not RAW or DNG files.
- Web Worker/OffscreenCanvas processing is not yet wired into this editor; image effects currently use a bounded Canvas 2D preview path.

The original import remains unchanged. Always keep a separate copy of important photographs and export recipes you want to reuse across browsers or devices.
