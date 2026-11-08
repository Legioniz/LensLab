# Camera, Lens, and Scene Customization

LENS LAB 0.4.0 ships with selectable reference profiles. The Settings screen selects among the built-in profiles: a Canon EOS 3000D reference body, generic APS-C and full-frame bodies, and three illustrative lens types. A graphical custom camera/lens profile editor is not included in 0.4.0; adding a new exact make/model currently means adding a validated typed profile in source code. Treat generic profiles as teaching references, not specifications for every camera.

## Add a camera body

1. Open `src/engine/cameraProfiles.ts`.
2. Add an object to `cameraProfiles` that satisfies the `CameraProfile` interface in `src/types/camera.ts`.
3. Enter the sensor width/height in millimeters, resolution, crop factor, supported ISO values, exposure-compensation limits, shutter range, exposure increment, and circle-of-confusion estimate.
4. Keep `isoValues` between `isoMin` and `isoMax`, and use the actual values supported by the body you are modeling.
5. Run `npm run typecheck` and `npm test`.

Treat manufacturer specifications as authoritative; label estimates such as circle of confusion as approximations.

## Add a lens

Add an object to `lensProfiles` in `src/engine/cameraProfiles.ts`. Provide focal-length limits, maximum and minimum aperture, minimum focusing distance, and stabilization support. For a variable-aperture zoom lens, set `maxApertureAtTele` to the maximum f-number at the long end. For a constant-aperture zoom or prime lens, omit it. The engine interpolates the maximum f-number over the focal range.

The shipped 18–55mm, 50mm, and 70–200mm entries are generic learning profiles. They are not confirmation of the exact lens mounted on a user's camera.

## Replace the bundled scene artwork

Scene definitions live in `src/engine/scenes.ts`; image layers live in `public/scenes/`. Each scene currently loads a background layer and a transparent subject layer. To replace the artwork, preserve the referenced filenames or update the paths in the scene definition. Use matching 3:2 dimensions and keep the subject layer transparent so its focus and motion effects remain separate from the background. SVG, PNG, and browser-supported raster images can be loaded by the browser image pipeline.

The supplied scenes are original vector illustrations. Real photographs and carefully prepared transparent subject cutouts will make the simulator more photographic, but the visual model will still be an approximation rather than an optical camera emulator. Use only images you own or have permission to use.
