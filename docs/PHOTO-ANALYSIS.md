# Photo Analysis and Processing — 0.4.0

## EXIF metadata

LENS LAB reads common EXIF tags locally from JPEG APP1, PNG eXIf, and WebP EXIF chunks. Supported fields include camera make/model, lens model, exposure time, f-number, ISO, focal length, capture timestamp, orientation, and whether GPS tags exist. Not every file contains every field. Metadata is informational; simulated camera settings are kept separate. GPS coordinates are not displayed.

## RGB histogram

The Photo Lab histogram samples the current rendered preview at a maximum 512-pixel long edge and plots red, green, blue, and luminance channels. This is a preview histogram, not a RAW sensor histogram.

## Worker rendering

When Worker, createImageBitmap, and OffscreenCanvas are available, preview rendering is delegated to a module worker. If setup, transfer, rendering, or response fails, the main-thread Canvas 2D renderer is used. Full-resolution export uses the main-thread path to keep export behavior deterministic.

## Depth mask

Import a grayscale image with the same aspect ratio as the source; its pixel resolution may differ. White represents the sharp subject; black represents the blurred background. Mask crop coordinates are mapped from photograph space into mask space before the shared crop and rotation are applied. This is user-guided mask compositing, not automatic subject segmentation or a recovered depth map.

## Fingerprints

SHA-256 is calculated through Web Crypto when available. If unavailable, the UI indicates that fingerprinting could not be completed. A recipe fingerprint mismatch triggers a confirmation before settings are applied.

## Geometry and color

Crop controls remove proportional edges; rotation is restricted to quarter turns. Vibrance, tint, and sharpening are lightweight educational approximations. Keep the original source file for maximum editability.

## Batch processing

Select up to 20 supported images. Each image is validated, processed with the current Photo Lab settings, and included as a JPEG in one uncompressed ZIP archive. Output is capped at 150 MB. ZIP entries use the STORE method to avoid a compression dependency and reduce CPU usage.
