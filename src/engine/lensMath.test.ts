import { describe, expect, it } from "vitest";
import { calculateDepthOfFieldEstimate, calculateHorizontalFieldOfView, maximumApertureAtFocalLength } from "./lensMath";

describe("lens comparison mathematics", () => {
  it("returns a wider field of view for a shorter focal length", () => {
    expect(calculateHorizontalFieldOfView(22.3, 18)).toBeGreaterThan(calculateHorizontalFieldOfView(22.3, 55));
  });
  it("estimates shallower depth of field with a wider aperture", () => {
    const wide = calculateDepthOfFieldEstimate(50, 1.8, 3, .019);
    const stopped = calculateDepthOfFieldEstimate(50, 8, 3, .019);
    expect(wide.totalM).toBeLessThan(stopped.totalM);
  });
  it("interpolates variable zoom maximum aperture", () => {
    const lens = { focalMinMm: 18, focalMaxMm: 55, maxAperture: 3.5, maxApertureAtTele: 5.6 };
    expect(maximumApertureAtFocalLength(lens, 18)).toBeCloseTo(3.5);
    expect(maximumApertureAtFocalLength(lens, 55)).toBeCloseTo(5.6);
  });
  it("rejects invalid optical inputs", () => {
    expect(() => calculateHorizontalFieldOfView(0, 50)).toThrow();
    expect(() => calculateDepthOfFieldEstimate(50, 0, 3, .019)).toThrow();
  });
});
