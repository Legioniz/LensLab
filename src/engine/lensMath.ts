export interface DepthOfFieldEstimate { nearM: number; farM: number; totalM: number; hyperfocalM: number; }
export function calculateHorizontalFieldOfView(sensorWidthMm: number, focalLengthMm: number): number {
  if (!Number.isFinite(sensorWidthMm) || sensorWidthMm <= 0 || !Number.isFinite(focalLengthMm) || focalLengthMm <= 0) throw new RangeError("Sensor width and focal length must be positive finite values.");
  return 2 * Math.atan(sensorWidthMm / (2 * focalLengthMm)) * 180 / Math.PI;
}
export function calculateDepthOfFieldEstimate(focalLengthMm: number, aperture: number, focusDistanceM: number, circleOfConfusionMm: number): DepthOfFieldEstimate {
  if ([focalLengthMm, aperture, focusDistanceM, circleOfConfusionMm].some((value) => !Number.isFinite(value) || value <= 0)) throw new RangeError("Focal length, aperture, focus distance, and circle of confusion must be positive finite values.");
  const f = focalLengthMm, n = aperture, c = circleOfConfusionMm, s = focusDistanceM * 1000;
  const hyperfocalMm = (f * f) / (n * c) + f;
  const nearMm = (hyperfocalMm * s) / (hyperfocalMm + (s - f));
  const farDenominator = hyperfocalMm - (s - f);
  const farMm = farDenominator > 0 ? (hyperfocalMm * s) / farDenominator : Infinity;
  return { nearM: nearMm / 1000, farM: farMm / 1000, totalM: Number.isFinite(farMm) ? (farMm - nearMm) / 1000 : Infinity, hyperfocalM: hyperfocalMm / 1000 };
}
export function maximumApertureAtFocalLength(input: { focalMinMm: number; focalMaxMm: number; maxAperture: number; maxApertureAtTele?: number }, focalLengthMm: number): number {
  const progress = input.focalMaxMm === input.focalMinMm ? 0 : Math.max(0, Math.min(1, (focalLengthMm - input.focalMinMm) / (input.focalMaxMm - input.focalMinMm)));
  return input.maxApertureAtTele === undefined ? input.maxAperture : input.maxAperture + (input.maxApertureAtTele - input.maxAperture) * progress;
}
