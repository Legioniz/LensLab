import type { CameraSettings, CameraProfile, LensProfile, SceneDefinition } from "../types/camera";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Metering value derived from aperture, exposure time and ISO. */
export function calculateEv100({ aperture, shutter, iso }: Pick<CameraSettings, "aperture" | "shutter" | "iso">): number {
  if (![aperture, shutter, iso].every((v) => Number.isFinite(v) && v > 0)) {
    throw new Error("Aperture, shutter speed, and ISO must all be positive finite numbers.");
  }
  return Math.log2((aperture * aperture) / shutter) - Math.log2(iso / 100);
}

/** Actual rendered exposure offset before exposure-compensation target bias. Positive means brighter than the scene reference. */
export function calculateExposureOffset(settings: CameraSettings, scene: SceneDefinition): number {
  return scene.sceneEv100 - calculateEv100(settings);
}

/** Meter offset includes the exposure-compensation target. Positive means settings exceed that adjusted target. */
export function calculateMeterOffset(settings: CameraSettings, scene: SceneDefinition): number {
  return calculateExposureOffset(settings, scene) - settings.exposureCompensation;
}

export function formatShutter(seconds: number): string {
  if (seconds >= 1) return `${Number(seconds.toFixed(1))}s`;
  if (seconds >= 0.5) return `${Number(seconds.toFixed(1))}s`;
  const reciprocal = 1 / seconds;
  return `1/${Math.round(reciprocal)}`;
}

export function calculateDepthOfField(
  focalLengthMm: number,
  aperture: number,
  focusDistanceM: number,
  camera: CameraProfile,
) {
  const f = focalLengthMm;
  const c = camera.circleOfConfusionMm;
  const s = focusDistanceM * 1000;
  const h = (f * f) / (aperture * c) + f;
  const near = (h * s) / (h + (s - f));
  const denominator = h - (s - f);
  const far = denominator <= 0 ? Number.POSITIVE_INFINITY : (h * s) / denominator;
  return {
    hyperfocalM: h / 1000,
    nearM: Math.max(0, near / 1000),
    farM: Number.isFinite(far) ? far / 1000 : Number.POSITIVE_INFINITY,
    totalM: Number.isFinite(far) ? Math.max(0, (far - near) / 1000) : Number.POSITIVE_INFINITY,
  };
}

export function solveShutter(aperture: number, iso: number, targetEv100: number): number {
  const shutter = (aperture * aperture) / (2 ** (targetEv100 + Math.log2(iso / 100)));
  return clamp(shutter, 1 / 8000, 30);
}

export function solveAperture(shutter: number, iso: number, targetEv100: number): number {
  return Math.sqrt(shutter * (2 ** (targetEv100 + Math.log2(iso / 100))));
}

export function applyAutoExposure(
  settings: CameraSettings,
  mode: "Av" | "Tv" | "P",
  scene: SceneDefinition,
  camera: CameraProfile,
  lens?: LensProfile,
): CameraSettings {
  const next = { ...settings };
  const target = scene.sceneEv100 - settings.exposureCompensation;
  if (mode === "Av") {
    next.shutter = clamp(solveShutter(next.aperture, next.iso, target), camera.shutterMin, camera.shutterMax);
  } else if (mode === "Tv") {
    const minimumFNumber = lens ? maxApertureAtFocal(lens, next.focalLength) : 1.8;
    const maximumFNumber = lens?.minAperture ?? 32;
    next.aperture = clamp(solveAperture(next.shutter, next.iso, target), minimumFNumber, maximumFNumber);
  } else {
    // Program mode biases aperture toward a practical hand-held range, then solves shutter.
    const minimumFNumber = lens ? maxApertureAtFocal(lens, next.focalLength) : 1.8;
    const maximumFNumber = lens?.minAperture ?? 32;
    next.aperture = clamp(scene.motion > 0.35 ? 4 : 5.6, minimumFNumber, maximumFNumber);
    next.shutter = clamp(solveShutter(next.aperture, next.iso, target), camera.shutterMin, camera.shutterMax);
  }
  next.iso = clamp(next.iso, camera.isoMin, camera.isoMax);
  return next;
}

export function maxApertureAtFocal(lens: LensProfile, focalLength: number): number {
  if (lens.focalMaxMm <= lens.focalMinMm) return lens.maxAperture;
  const progress = clamp((focalLength - lens.focalMinMm) / (lens.focalMaxMm - lens.focalMinMm), 0, 1);
  const telephotoMaximum = lens.maxApertureAtTele ?? lens.maxAperture;
  return lens.maxAperture + progress * (telephotoMaximum - lens.maxAperture);
}

export function exposureLabel(offset: number): string {
  if (Math.abs(offset) < 0.25) return "Well balanced";
  return offset > 0 ? "Overexposed" : "Underexposed";
}
