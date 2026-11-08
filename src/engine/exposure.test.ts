import { describe, expect, it } from "vitest";
import { applyAutoExposure, calculateDepthOfField, calculateEv100, calculateExposureOffset, calculateMeterOffset, formatShutter, solveShutter } from "./exposure";
import { cameraProfiles, lensProfiles, validateCameraProfile, validateLensProfile } from "./cameraProfiles";
import { getScene } from "./scenes";
import type { CameraSettings } from "../types/camera";

const base: CameraSettings = {
  aperture: 4,
  shutter: 1 / 125,
  iso: 100,
  focalLength: 50,
  focusDistance: 3,
  exposureCompensation: 0,
  focusMode: "AF-S",
};

describe("exposure engine", () => {
  it("ships structurally valid camera profiles with model-specific ISO steps", () => {
    expect(cameraProfiles.flatMap(validateCameraProfile)).toEqual([]);
    expect(lensProfiles.flatMap(validateLensProfile)).toEqual([]);
    expect(cameraProfiles[0].isoValues).toEqual([100, 200, 400, 800, 1600, 3200, 6400]);
  });

  it("calculates EV100 using aperture, shutter time, and ISO", () => {
    expect(calculateEv100(base)).toBeCloseTo(10.9658, 3);
  });

  it("rejects invalid exposure values", () => {
    expect(() => calculateEv100({ ...base, aperture: 0 })).toThrow();
    expect(() => calculateEv100({ ...base, iso: Number.NaN })).toThrow();
  });

  it("calculates the scene-referenced exposure offset", () => {
    const portrait = getScene("portrait");
    expect(calculateExposureOffset(base, portrait)).toBeCloseTo(portrait.sceneEv100 - calculateEv100(base), 8);
  });

  it("keeps actual exposure separate from the meter compensation target", () => {
    const portrait = getScene("portrait");
    const normal = calculateExposureOffset(base, portrait);
    const shiftedSettings = { ...base, exposureCompensation: 1 };
    expect(calculateExposureOffset(shiftedSettings, portrait)).toBeCloseTo(normal, 8);
    expect(calculateMeterOffset(shiftedSettings, portrait) - calculateMeterOffset(base, portrait)).toBeCloseTo(-1, 8);
  });

  it("formats shutter durations", () => {
    expect(formatShutter(1 / 250)).toBe("1/250");
    expect(formatShutter(2)).toBe("2s");
    expect(formatShutter(1 / 1.3)).toBe("0.8s");
  });

  it("solves a shutter duration for a target EV100", () => {
    const shutter = solveShutter(4, 100, 10);
    expect(calculateEv100({ ...base, aperture: 4, iso: 100, shutter })).toBeCloseTo(10, 8);
  });


  it("solves aperture-priority exposure against the scene and compensation target", () => {
    const portrait = getScene("portrait");
    const settings = { ...base, aperture: 4, iso: 400, exposureCompensation: 1 };
    const solved = applyAutoExposure(settings, "Av", portrait, cameraProfiles[0]);
    expect(calculateMeterOffset(solved, portrait)).toBeCloseTo(0, 8);
    expect(solved.aperture).toBe(4);
  });

  it("solves shutter-priority exposure while respecting the lens aperture range", () => {
    const portrait = getScene("portrait");
    const settings = { ...base, shutter: 1 / 125, iso: 400, exposureCompensation: 0 };
    const solved = applyAutoExposure(settings, "Tv", portrait, cameraProfiles[0], {
      id: "test-lens", manufacturer: "Test", model: "50mm f/1.8", focalMinMm: 50,
      focalMaxMm: 50, maxAperture: 1.8, minAperture: 22, minFocusDistanceM: 0.35,
      stabilization: false,
    });
    expect(solved.aperture).toBeGreaterThanOrEqual(1.8);
    expect(solved.aperture).toBeLessThanOrEqual(22);
    expect(calculateMeterOffset(solved, portrait)).toBeCloseTo(0, 8);
  });

  it("solves a Program-mode exposure against the current scene target", () => {
    const landscape = getScene("landscape");
    const solved = applyAutoExposure({ ...base, iso: 100 }, "P", landscape, cameraProfiles[0]);
    expect(calculateMeterOffset(solved, landscape)).toBeCloseTo(0, 8);
  });

  it("calculates a finite depth-of-field range for a normal focus distance", () => {
    const result = calculateDepthOfField(50, 4, 3, cameraProfiles[0]);
    expect(result.nearM).toBeGreaterThan(0);
    expect(result.farM).toBeGreaterThan(result.nearM);
    expect(result.hyperfocalM).toBeGreaterThan(0);
  });
});
