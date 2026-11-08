import type { CameraMode, CameraSettings } from "../types/camera";
import type { PresetDocument, PresetRecord } from "../types/preset";

const modes: CameraMode[] = ["M", "Av", "Tv", "P"];
const focusModes = ["AF-S", "AF-C", "MF"] as const;

export interface PresetDraft {
  name: string;
  description: string;
  cameraProfileId: string;
  lensProfileId: string;
  mode: CameraMode;
  sceneId: string;
  settings: CameraSettings;
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `preset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function serializePreset(document: PresetDocument): string {
  return [
    "# LENS LAB PRESET",
    "# Plain-text settings snapshot. You can edit the JSON fields and import this file again.",
    "# Keep format and schemaVersion unchanged when editing manually.",
    JSON.stringify(document, null, 2),
    "",
  ].join("\n");
}

export function parsePresetText(text: string): PresetDocument {
  if (typeof text !== "string" || text.length > 256_000) throw new Error("Preset file is empty or larger than 256 KB.");
  const jsonStart = text.indexOf("{");
  if (jsonStart < 0) throw new Error("Preset text does not contain a JSON settings block.");
  let value: unknown;
  try { value = JSON.parse(text.slice(jsonStart)); }
  catch { throw new Error("Preset JSON is invalid. Check brackets, commas, and quotation marks."); }
  if (!value || typeof value !== "object") throw new Error("Preset content must be an object.");
  const data = value as Record<string, unknown>;
  const settings = data.settings as Record<string, unknown> | undefined;
  if (data.format !== "lens-lab-preset" || data.schemaVersion !== 1) throw new Error("Unsupported preset format or schema version.");
  if (typeof data.name !== "string" || !data.name.trim()) throw new Error("Preset name is required.");
  if (typeof data.cameraProfileId !== "string" || typeof data.lensProfileId !== "string" || typeof data.sceneId !== "string") throw new Error("Preset is missing camera, lens, or scene identifiers.");
  if (!modes.includes(data.mode as CameraMode)) throw new Error("Preset shooting mode is not supported.");
  if (!settings) throw new Error("Preset settings are missing.");
  const requiredNumbers = ["aperture", "shutter", "iso", "focalLength", "focusDistance", "exposureCompensation"];
  for (const key of requiredNumbers) {
    if (typeof settings[key] !== "number" || !Number.isFinite(settings[key] as number)) throw new Error(`Preset setting '${key}' must be a finite number.`);
  }
  if ((settings.aperture as number) <= 0 || (settings.shutter as number) <= 0 || (settings.iso as number) < 1 || (settings.focalLength as number) <= 0 || (settings.focusDistance as number) <= 0) {
    throw new Error("Aperture, shutter, focal length, focus distance, and ISO must be positive values.");
  }
  if (!focusModes.includes(settings.focusMode as typeof focusModes[number])) throw new Error("Preset focus mode is not supported.");
  return {
    format: "lens-lab-preset",
    schemaVersion: 1,
    id: typeof data.id === "string" ? data.id : makeId(),
    name: data.name.trim().slice(0, 80),
    description: typeof data.description === "string" ? data.description.slice(0, 500) : "",
    version: Number.isInteger(data.version) && (data.version as number) > 0 ? data.version as number : 1,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
    cameraProfileId: data.cameraProfileId,
    lensProfileId: data.lensProfileId,
    mode: data.mode as CameraMode,
    sceneId: data.sceneId,
    settings: settings as unknown as CameraSettings,
  };
}

export function createPresetRecord(draft: PresetDraft, now = Date.now()): PresetRecord {
  const date = new Date(now).toISOString();
  const document: PresetDocument = {
    format: "lens-lab-preset", schemaVersion: 1, id: makeId(),
    name: draft.name.trim().slice(0, 80), description: draft.description.trim().slice(0, 500),
    version: 1, createdAt: date, updatedAt: date,
    cameraProfileId: draft.cameraProfileId, lensProfileId: draft.lensProfileId,
    mode: draft.mode, sceneId: draft.sceneId, settings: { ...draft.settings },
  };
  const text = serializePreset(document);
  return { id: document.id, name: document.name, description: document.description, createdAt: now, updatedAt: now, currentVersion: 1, currentText: text, versions: [{ version: 1, savedAt: now, text }] };
}

export function updatePresetRecord(record: PresetRecord, draft: PresetDraft, now = Date.now()): PresetRecord {
  const document = parsePresetText(record.currentText);
  const version = record.currentVersion + 1;
  const updated: PresetDocument = {
    ...document,
    name: draft.name.trim().slice(0, 80), description: draft.description.trim().slice(0, 500),
    version, updatedAt: new Date(now).toISOString(),
    cameraProfileId: draft.cameraProfileId, lensProfileId: draft.lensProfileId,
    mode: draft.mode, sceneId: draft.sceneId, settings: { ...draft.settings },
  };
  const text = serializePreset(updated);
  return {
    ...record, name: updated.name, description: updated.description, updatedAt: now,
    currentVersion: version, currentText: text,
    versions: [...record.versions, { version, savedAt: now, text }],
  };
}

export function importPresetRecord(text: string, now = Date.now()): PresetRecord {
  const document = parsePresetText(text);
  const imported = { ...document, id: makeId(), version: 1, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
  const normalizedText = serializePreset(imported);
  return {
    id: imported.id, name: imported.name, description: imported.description,
    createdAt: now, updatedAt: now, currentVersion: 1,
    currentText: normalizedText, versions: [{ version: 1, savedAt: now, text: normalizedText }],
  };
}
