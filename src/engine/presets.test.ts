import { describe, expect, it } from "vitest";
import { createPresetRecord, parsePresetText, updatePresetRecord } from "./presets";
import type { CameraSettings } from "../types/camera";

const settings: CameraSettings = {
  aperture: 4, shutter: 1 / 250, iso: 400, focalLength: 50,
  focusDistance: 2.5, exposureCompensation: 0, focusMode: "AF-S",
};
const draft = {
  name: "Portrait test", description: "Soft background", cameraProfileId: "canon-eos-3000d-reference",
  lensProfileId: "generic-50-prime", mode: "M" as const, sceneId: "portrait", settings,
};

describe("preset text format", () => {
  it("serializes a new preset to readable, importable text", () => {
    const record = createPresetRecord(draft, 1000);
    const parsed = parsePresetText(record.currentText);
    expect(parsed.name).toBe("Portrait test");
    expect(parsed.settings.shutter).toBe(1 / 250);
    expect(record.versions).toHaveLength(1);
  });
  it("creates immutable version snapshots when updated", () => {
    const first = createPresetRecord(draft, 1000);
    const second = updatePresetRecord(first, { ...draft, settings: { ...settings, aperture: 2.8 } }, 2000);
    expect(second.currentVersion).toBe(2);
    expect(second.versions).toHaveLength(2);
    expect(parsePresetText(first.currentText).settings.aperture).toBe(4);
    expect(parsePresetText(second.currentText).settings.aperture).toBe(2.8);
  });
  it("rejects malformed preset files", () => {
    expect(() => parsePresetText("not a preset")).toThrow();
    expect(() => parsePresetText("# LENS LAB PRESET\n{\"format\":\"wrong\"}")).toThrow();
  });
});
