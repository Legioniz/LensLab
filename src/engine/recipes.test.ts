import { describe, expect, it } from "vitest";
import type { CameraSettings } from "../types/camera";
import {
  appendPhotoRecipeRevision,
  createPhotoRecipeDocument,
  createPhotoRecipeRecord,
  parsePhotoRecipe,
  parsePhotoRecipeFile,
  restorePhotoRecipeRevision,
  serializePhotoRecipe,
  serializePhotoRecipeRecord,
} from "./recipes";
import type { PhotoLabAdjustments } from "./photoLab";

const cameraSettings: CameraSettings = {
  aperture: 2.8, shutter: 1 / 250, iso: 400, focalLength: 50,
  focusDistance: 2.5, exposureCompensation: 0, focusMode: "AF-S",
};
const adjustments: PhotoLabAdjustments = {
  exposure: 0.5, contrast: 1.1, saturation: 1, focusSoftness: 0, warmth: 5, vibrance: 0, tint: 0, sharpen: 0, rotation: 0, cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0, depthBlur: 0,
};

function fixture() {
  return createPhotoRecipeDocument({
    id: "recipe-test", name: "Portrait soft light", image: { name: "portrait.jpg", width: 6000, height: 4000 },
    mode: "M", cameraSettings, adjustments,
  });
}

describe("Photo Lab shot recipes", () => {
  it("serializes a readable TXT file and parses its settings", () => {
    const text = serializePhotoRecipe(fixture());
    expect(text.startsWith("LENS LAB SHOT RECIPE")).toBe(true);
    const parsed = parsePhotoRecipe(text);
    expect(parsed.name).toBe("Portrait soft light");
    expect(parsed.cameraSettings.iso).toBe(400);
    expect(parsed.adjustments.exposure).toBe(0.5);
  });

  it("creates immutable revisions rather than overwriting the previous snapshot", () => {
    const first = fixture();
    const record = createPhotoRecipeRecord(first);
    const changed = createPhotoRecipeDocument({
      ...first, id: first.id, revision: 2, createdAt: first.createdAt,
      adjustments: { ...adjustments, exposure: 1.25 }, history: first.history,
    });
    const updated = appendPhotoRecipeRevision(record, changed, "Raised exposure");
    expect(updated.currentRevision).toBe(2);
    expect(updated.versions).toHaveLength(2);
    expect(parsePhotoRecipe(updated.versions[0].text).adjustments.exposure).toBe(0.5);
    expect(parsePhotoRecipe(updated.currentText).adjustments.exposure).toBe(1.25);
  });

  it("exports and imports all immutable revision snapshots in the portable TXT bundle", () => {
    const first = fixture();
    const record = createPhotoRecipeRecord(first);
    const changed = createPhotoRecipeDocument({
      ...first, id: first.id, revision: 2, createdAt: first.createdAt,
      adjustments: { ...adjustments, exposure: 1.25 }, history: first.history,
    });
    const updated = appendPhotoRecipeRevision(record, changed, "Raised exposure");
    const bundle = serializePhotoRecipeRecord(updated);
    expect(bundle.startsWith("LENS LAB SHOT RECIPE — VERSIONED BUNDLE")).toBe(true);
    const imported = parsePhotoRecipeFile(bundle);
    expect(imported.document.revision).toBe(2);
    expect(imported.versions).toHaveLength(2);
    expect(parsePhotoRecipe(imported.versions[0].text).adjustments.exposure).toBe(0.5);
    expect(parsePhotoRecipe(imported.versions[1].text).adjustments.exposure).toBe(1.25);
  });

  it("restores an earlier revision as a new revision", () => {
    const record = createPhotoRecipeRecord(fixture());
    const changed = createPhotoRecipeDocument({
      ...fixture(), revision: 2, adjustments: { ...adjustments, contrast: 1.4 },
    });
    const updated = appendPhotoRecipeRevision(record, changed, "Changed contrast");
    const restored = restorePhotoRecipeRevision(updated, 1);
    expect(restored.currentRevision).toBe(3);
    expect(parsePhotoRecipe(restored.currentText).adjustments.contrast).toBe(1.1);
  });

  it("rejects unsupported schemas, invalid camera settings, and out-of-range adjustments", () => {
    const text = serializePhotoRecipe(fixture());
    expect(() => parsePhotoRecipe(text.replace('"schemaVersion": 1', '"schemaVersion": 99'))).toThrow("Unsupported recipe format");
    const invalidCamera = JSON.parse(text.slice(text.indexOf("{")));
    invalidCamera.cameraSettings.iso = 0;
    expect(() => parsePhotoRecipe(`LENS LAB SHOT RECIPE\n${JSON.stringify(invalidCamera)}`)).toThrow("must be positive");
    const invalidAdjustment = JSON.parse(text.slice(text.indexOf("{")));
    invalidAdjustment.adjustments.exposure = 20;
    expect(() => parsePhotoRecipe(`LENS LAB SHOT RECIPE\n${JSON.stringify(invalidAdjustment)}`)).toThrow("must be between");
  });

  it("rejects malformed or oversized recipe documents", () => {
    expect(() => parsePhotoRecipe("not a recipe")).toThrow("does not contain");
    expect(() => parsePhotoRecipe("x".repeat(256_001))).toThrow("256 KB");
  });
});
