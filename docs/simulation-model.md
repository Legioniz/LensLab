# LENS LAB — Simulation Theory and Model

This document distinguishes established photography relationships from the simulator's visual approximations.

## 1. Exposure value

For aperture f-number `N`, shutter time `t` in seconds, and ISO sensitivity `S`:

`EV100 = log2(N² / t) - log2(S / 100)`

Aperture and shutter are dimensionless/seconds as specified; ISO is a positive sensitivity number. A one-stop exposure change doubles or halves the amount of exposure. For example, changing ISO 100 to ISO 200 is +1 stop of sensitivity; changing shutter time from 1/250s to 1/125s doubles exposure duration; changing f/4 to f/2.8 approximately doubles the aperture area.

### Meter convention in LENS LAB

Each scene stores a target `sceneEv100`. The meter offset is:

`imageExposureOffset = sceneEv100 - settingsEv100`

`meterOffset = imageExposureOffset - exposureCompensation`

- Near zero: settings are close to the scene's teaching reference.
- Positive image exposure offset: the rendered exposure is brighter than the scene reference.
- Negative image exposure offset: the rendered exposure is darker than the scene reference.
- Positive exposure compensation shifts the automatic-exposure target toward more exposure. In Manual mode it shifts the meter target but does not change the image until the user changes settings.

This is a deliberately defined teaching convention. It is not a reflected-light meter reading from a physical camera, and a scene target is a project parameter rather than a measurement of real-world luminance.

## 2. Exposure triangle

Aperture changes the lens opening and depth of field. Shutter duration changes time integration and motion rendering. ISO changes the signal amplification/noise model. These controls are coupled: an exposure adjustment can often be compensated by one of the other two controls, but the photograph may have different motion, focus, or noise characteristics.

## 3. Priority-mode solvers

For a target scene EV100, aperture `N`, and ISO `S`, the shutter solver rearranges the EV100 equation:

`t = N² / 2^(targetEV100 + log2(S / 100))`

Aperture Priority (Av) holds aperture and ISO and solves shutter. Shutter Priority (Tv) holds shutter and ISO and solves aperture. Program (P) selects a scene-dependent aperture bias and solves shutter. Values are clamped to broad simulated limits; this is not a model of a proprietary camera's exact program line.

## 4. Depth of field

Hyperfocal distance:

`H = f² / (N × c) + f`

where focal length `f` and circle of confusion `c` use the same unit (millimeters), and focus distance `s` is converted to millimeters.

Near limit:

`Dnear = (H × s) / (H + (s - f))`

Far limit:

`Dfar = (H × s) / (H - (s - f))`

When the far-limit denominator is zero or negative, the far limit is treated as infinity. LENS LAB uses the camera profile's circle-of-confusion value. Real perceived depth of field also depends on output size, viewing distance, focus accuracy, lens aberrations, and the chosen acceptability criterion.

## 5. Image rendering approximation

The current version loads local scene background and subject layers, then applies:

- brightness scaling from the scene-referenced image-exposure offset (separate from the exposure-compensation-adjusted meter offset);
- background and subject blur based on aperture, focal length, and focus-distance mismatch;
- motion ghosting/blur for motion scenes at slower shutter settings;
- precomputed synthetic luminance noise textures with ISO-dependent strength;
- radial vignetting with a focal-length/aperture heuristic;
- optional rule-of-thirds and focus-point overlays in the viewfinder.

This is a compositing model, not a ray tracer or a physical lens simulation. Flat vector layers cannot reproduce complex occlusion, optical bokeh, depth-dependent blur across every pixel, true subject movement, or lens-specific aberrations. Bundled SVG scenes make the project self-contained and offline-friendly, but they are not real photographs.

## 6. Histogram

The live histogram samples the rendered Canvas pixels and bins approximate luminance into 32 buckets. It is therefore a histogram of the processed preview, not a RAW sensor histogram, color histogram, or camera-native JPEG histogram.

## 7. Sensor noise

Noise strength rises with ISO using a simplified logarithmic relationship and a reusable synthetic texture. It is illustrative and does not model a particular sensor's read noise, photon shot noise, full-well capacity, analog gain stages, demosaicing, or noise reduction pipeline.

## 8. Future fidelity upgrades

1. Add per-pixel depth-map compositing and a configurable circle-of-confusion kernel.
2. Calibrate scene brightness using known grey-card references.
3. Add lens-specific focal-length/aperture lookup curves and profiles.
4. Add sensor noise models with photon shot noise and read noise components.
5. Add subject motion vectors and panning parameters.
6. Move high-resolution effects to WebGL or Web Workers after profiling demonstrates a need.
