import type { CameraProfile, LensProfile } from "../types/camera";

export const cameraProfiles: CameraProfile[] = [
  {
    id: "canon-eos-3000d-reference",
    manufacturer: "Canon",
    model: "EOS 3000D (reference profile)",
    sensorWidthMm: 22.3,
    sensorHeightMm: 14.9,
    resolutionWidth: 5184,
    resolutionHeight: 3456,
    cropFactor: 1.6,
    isoMin: 100,
    isoMax: 6400,
    isoValues: [100, 200, 400, 800, 1600, 3200, 6400],
    exposureCompensationMinEv: -5,
    exposureCompensationMaxEv: 5,
    exposureCompensationStepEv: 1 / 3,
    shutterMin: 1 / 4000,
    shutterMax: 30,
    exposureStep: 1 / 3,
    circleOfConfusionMm: 0.019,
  },
  {
    id: "generic-aps-c",
    manufacturer: "Generic",
    model: "APS-C interchangeable-lens camera",
    sensorWidthMm: 23.5,
    sensorHeightMm: 15.6,
    resolutionWidth: 6000,
    resolutionHeight: 4000,
    cropFactor: 1.5,
    isoMin: 100,
    isoMax: 25600,
    isoValues: [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600],
    exposureCompensationMinEv: -5,
    exposureCompensationMaxEv: 5,
    exposureCompensationStepEv: 1 / 3,
    shutterMin: 1 / 8000,
    shutterMax: 30,
    exposureStep: 1 / 3,
    circleOfConfusionMm: 0.020,
  },
  {
    id: "generic-full-frame",
    manufacturer: "Generic",
    model: "Full-frame interchangeable-lens camera",
    sensorWidthMm: 36,
    sensorHeightMm: 24,
    resolutionWidth: 6000,
    resolutionHeight: 4000,
    cropFactor: 1,
    isoMin: 50,
    isoMax: 51200,
    isoValues: [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000, 51200],
    exposureCompensationMinEv: -5,
    exposureCompensationMaxEv: 5,
    exposureCompensationStepEv: 1 / 3,
    shutterMin: 1 / 8000,
    shutterMax: 30,
    exposureStep: 1 / 3,
    circleOfConfusionMm: 0.030,
  },
];

export const lensProfiles: LensProfile[] = [
  {
    id: "generic-18-55",
    manufacturer: "Generic reference",
    model: "18–55mm variable-aperture zoom (illustrative)",
    focalMinMm: 18,
    focalMaxMm: 55,
    maxAperture: 3.5,
    maxApertureAtTele: 5.6,
    minAperture: 22,
    minFocusDistanceM: 0.25,
    stabilization: true,
  },
  {
    id: "generic-50-prime",
    manufacturer: "Generic reference",
    model: "50mm f/1.8 prime (illustrative)",
    focalMinMm: 50,
    focalMaxMm: 50,
    maxAperture: 1.8,
    minAperture: 22,
    minFocusDistanceM: 0.35,
    stabilization: false,
  },
  {
    id: "generic-70-200",
    manufacturer: "Generic reference",
    model: "70–200mm f/2.8 zoom (illustrative)",
    focalMinMm: 70,
    focalMaxMm: 200,
    maxAperture: 2.8,
    minAperture: 32,
    minFocusDistanceM: 0.95,
    stabilization: true,
  },
];

export function validateCameraProfile(profile: CameraProfile): string[] {
  const errors: string[] = [];
  const positive = (value: number) => Number.isFinite(value) && value > 0;
  if (!profile.id.trim() || !profile.manufacturer.trim() || !profile.model.trim()) errors.push("Camera profile identity fields are required.");
  if (!positive(profile.sensorWidthMm) || !positive(profile.sensorHeightMm)) errors.push("Sensor dimensions must be positive finite values.");
  if (!Number.isInteger(profile.resolutionWidth) || !Number.isInteger(profile.resolutionHeight) || profile.resolutionWidth <= 0 || profile.resolutionHeight <= 0) errors.push("Sensor resolution must use positive integer pixel dimensions.");
  if (!positive(profile.cropFactor)) errors.push("Crop factor must be positive.");
  if (!positive(profile.isoMin) || !positive(profile.isoMax) || profile.isoMax < profile.isoMin || profile.isoValues.length === 0) errors.push("ISO range or supported ISO values are invalid.");
  if (profile.isoValues.some((value) => !positive(value) || value < profile.isoMin || value > profile.isoMax) || new Set(profile.isoValues).size !== profile.isoValues.length) errors.push("Supported ISO values must be unique and inside the camera's ISO range.");
  if (!Number.isFinite(profile.exposureCompensationMinEv) || !Number.isFinite(profile.exposureCompensationMaxEv) || profile.exposureCompensationMinEv >= profile.exposureCompensationMaxEv || !positive(profile.exposureCompensationStepEv)) errors.push("Exposure compensation range is invalid.");
  if (!positive(profile.shutterMin) || !positive(profile.shutterMax) || profile.shutterMax < profile.shutterMin) errors.push("Shutter range is invalid.");
  if (!positive(profile.exposureStep)) errors.push("Exposure step must be positive.");
  if (!positive(profile.circleOfConfusionMm)) errors.push("Circle of confusion must be positive.");
  return errors;
}

export function validateLensProfile(profile: LensProfile): string[] {
  const errors: string[] = [];
  const positive = (value: number) => Number.isFinite(value) && value > 0;
  if (!profile.id.trim() || !profile.manufacturer.trim() || !profile.model.trim()) errors.push("Lens profile identity fields are required.");
  if (!positive(profile.focalMinMm) || !positive(profile.focalMaxMm) || profile.focalMaxMm < profile.focalMinMm) errors.push("Focal-length range is invalid.");
  if (!positive(profile.maxAperture) || !positive(profile.minAperture) || profile.minAperture < profile.maxAperture) errors.push("Lens aperture range is invalid.");
  if (profile.maxApertureAtTele !== undefined && (!positive(profile.maxApertureAtTele) || profile.maxApertureAtTele < profile.maxAperture || profile.maxApertureAtTele > profile.minAperture)) errors.push("Variable-zoom telephoto aperture is outside the lens aperture range.");
  if (!positive(profile.minFocusDistanceM)) errors.push("Minimum focus distance must be positive.");
  return errors;
}
