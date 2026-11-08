# Lens Comparison Lab — 0.4.0

Select two built-in lens profiles and adjust a common reference focal length, aperture, and focus distance. LENS LAB clamps each comparison to each lens profile's supported limits. Variable-aperture zooms interpolate their maximum f-number between the wide and telephoto endpoints as an educational approximation.

Horizontal field of view uses `2 × atan(sensor width / (2 × focal length))`. Approximate depth of field uses the selected camera's circle of confusion and the hyperfocal-distance model. Results are educational geometric estimates. They do not account for every lens aberration, focus breathing, pupil magnification, sensor sampling, or subjective sharpness.

The built-in lens profiles are illustrative examples, not claims about the exact lens attached to a user's camera. Edit or extend the profile definitions in `src/engine/cameraProfiles.ts` when adding verified lens specifications.
