import { describe, expect, it } from "vitest";
import { adjustedExposureMultiplier, getPhotoRenderGeometry, mapPhotoCropToMask, photoLabDownloadName, relativeExposureMultiplier, validatePhotoDimensions, validatePhotoFile } from "./photoLab";
import type { CameraSettings } from "../types/camera";

const base: CameraSettings = {
  aperture: 4, shutter: 1 / 125, iso: 100, focalLength: 50,
  focusDistance: 3, exposureCompensation: 0, focusMode: "AF-S",
};

describe("Photo Lab helpers", () => {
  it("returns unity exposure for unchanged baseline settings", () => {
    expect(relativeExposureMultiplier(base, base)).toBeCloseTo(1, 5);
  });
  it("makes a one-stop exposure increase twice as bright", () => {
    expect(relativeExposureMultiplier(base, { ...base, shutter: 1 / 62.5 })).toBeCloseTo(2, 1);
  });
  it("applies manual exposure adjustment in EV stops", () => {
    expect(adjustedExposureMultiplier(base, base, 1)).toBeCloseTo(2, 5);
    expect(adjustedExposureMultiplier(base, base, -1)).toBeCloseTo(0.5, 5);
  });
  it("creates a safe export name", () => {
    expect(photoLabDownloadName("My family photo.png")).toBe("My-family-photo-lens-lab.jpg");
  });
  it("accepts supported formats using MIME or filename extension", () => {
    expect(validatePhotoFile({ name: "photo.jpg", type: "", size: 1024 })).toBeNull();
    expect(validatePhotoFile({ name: "photo.webp", type: "image/webp", size: 1024 })).toBeNull();
  });
  it("rejects unsupported and oversized photo files", () => {
    expect(validatePhotoFile({ name: "photo.heic", type: "image/heic", size: 1024 })).toContain("JPEG");
    expect(validatePhotoFile({ name: "photo.jpg", type: "image/jpeg", size: 31 * 1024 * 1024 })).toContain("30 MB");
  });
  it("rejects invalid or oversized decoded dimensions", () => {
    expect(validatePhotoDimensions(0, 100)).toContain("dimensions");
    expect(validatePhotoDimensions(10_000, 6_000)).toContain("50 megapixels");
    expect(validatePhotoDimensions(6000, 4000)).toBeNull();
  });
  it("maps a photograph crop into a differently sized subject mask", () => {
    const geometry = getPhotoRenderGeometry(6000, 4000, {
      exposure: 0, contrast: 1, saturation: 1, focusSoftness: 0, warmth: 0,
      vibrance: 0, tint: 0, sharpen: 0, rotation: 0,
      cropLeft: .1, cropTop: .2, cropRight: .1, cropBottom: .1, depthBlur: 8,
    }, "balanced");
    expect(mapPhotoCropToMask(6000, 4000, 1500, 1000, geometry)).toEqual({
      x: 150, y: 200, width: 1200, height: 700,
    });
  });
  it("uses the same preview dimensions for all quarter-turn rotations", () => {
    const adjustments = {
      exposure: 0, contrast: 1, saturation: 1, focusSoftness: 0, warmth: 0,
      vibrance: 0, tint: 0, sharpen: 0, rotation: 0,
      cropLeft: .1, cropTop: .1, cropRight: .1, cropBottom: .1, depthBlur: 0,
    };
    const normal = getPhotoRenderGeometry(4000, 3000, adjustments, "balanced");
    const rotated = getPhotoRenderGeometry(4000, 3000, { ...adjustments, rotation: 90 }, "balanced");
    expect(rotated.width).toBe(normal.height);
    expect(rotated.height).toBe(normal.width);
    expect(rotated.cropX).toBe(normal.cropX);
    expect(rotated.cropY).toBe(normal.cropY);
  });
  it("rejects invalid dimensions when mapping mask coordinates", () => {
    expect(() => mapPhotoCropToMask(0, 4000, 1000, 1000, {
      cropX: 0, cropY: 0, sourceCropWidth: 100, sourceCropHeight: 100,
    })).toThrow("dimensions must be positive");
  });
});
