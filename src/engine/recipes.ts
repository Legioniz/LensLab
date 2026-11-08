import type { CameraMode, CameraSettings } from "../types/camera";
import type { PhotoRecipeDocument, PhotoRecipeRecord, PhotoRecipeVersion } from "../types/recipe";
import type { PhotoLabAdjustments } from "./photoLab";

const MAX_TEXT_LENGTH = 256_000;
export function createPhotoRecipeDocument(input: {
  id?: string;
  name: string;
  description?: string;
  image: PhotoRecipeDocument["image"];
  mode: CameraMode;
  cameraSettings: CameraSettings;
  adjustments: PhotoLabAdjustments;
  revision?: number;
  createdAt?: string;
  history?: string[];
}): PhotoRecipeDocument {
  const now = new Date().toISOString();
  return {
    format: "lens-lab-photo-recipe",
    schemaVersion: 1,
    id: input.id ?? (globalThis.crypto?.randomUUID?.() ?? `recipe-${Date.now()}`),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    revision: input.revision ?? 1,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    image: { ...input.image },
    mode: input.mode,
    cameraSettings: { ...input.cameraSettings },
    adjustments: { ...input.adjustments },
    history: [...(input.history ?? []), `Revision ${input.revision ?? 1}: saved`].slice(-100),
  };
}

export function serializePhotoRecipe(document: PhotoRecipeDocument): string {
  return [
    "LENS LAB SHOT RECIPE",
    "====================",
    "# Portable, human-readable recipe. The original photograph is never embedded.",
    "# The JSON block is schema-versioned; edit values carefully before importing.",
    JSON.stringify(document, null, 2),
    "",
  ].join("\n");
}

export function parsePhotoRecipe(text: string): PhotoRecipeDocument {
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    throw new Error("Recipe file is empty or exceeds the 256 KB safety limit.");
  }
  const start = text.indexOf("{");
  if (start < 0) throw new Error("Recipe file does not contain a settings block.");
  let raw: unknown;
  try { raw = JSON.parse(text.slice(start)); }
  catch { throw new Error("Recipe content is not valid JSON. Check the file and try again."); }
  if (!raw || typeof raw !== "object") throw new Error("Recipe content must be an object.");
  const value = raw as Record<string, unknown>;
  if (value.format !== "lens-lab-photo-recipe" || value.schemaVersion !== 1) {
    throw new Error("Unsupported recipe format or schema version.");
  }
  if (typeof value.id !== "string" || typeof value.name !== "string" || !value.name.trim()) {
    throw new Error("Recipe ID and a non-empty name are required.");
  }
  if (!value.image || typeof value.image !== "object" || !value.cameraSettings || typeof value.cameraSettings !== "object" || !value.adjustments || typeof value.adjustments !== "object") {
    throw new Error("Recipe is missing image, camera, or adjustment information.");
  }
  const image = value.image as Record<string, unknown>;
  if (typeof image.name !== "string" || !Number.isInteger(image.width) || !Number.isInteger(image.height) || Number(image.width) <= 0 || Number(image.height) <= 0 || (image.fingerprint !== undefined && (typeof image.fingerprint !== "string" || !/^[a-f0-9]{64}$/i.test(image.fingerprint)))) {
    throw new Error("Recipe image information is invalid.");
  }
  if (!["M", "Av", "Tv", "P"].includes(String(value.mode))) throw new Error("Recipe shooting mode is invalid.");
  const camera = value.cameraSettings as Record<string, unknown>;
  const cameraNumbers = ["aperture", "shutter", "iso", "focalLength", "focusDistance", "exposureCompensation"];
  if (!("focusMode" in camera) || !["AF-S", "AF-C", "MF"].includes(String(camera.focusMode))) {
    throw new Error("Camera focus mode is invalid.");
  }
  for (const key of cameraNumbers) {
    if (typeof camera[key] !== "number" || !Number.isFinite(camera[key])) throw new Error(`Camera setting '${key}' must be a finite number.`);
  }
  if (Number(camera.aperture) <= 0 || Number(camera.shutter) <= 0 || Number(camera.iso) < 1 || Number(camera.focalLength) <= 0 || Number(camera.focusDistance) <= 0) {
    throw new Error("Camera settings must be positive for aperture, shutter, ISO, focal length, and focus distance.");
  }
  const adjustments = value.adjustments as Record<string, unknown>;
  const defaults: PhotoLabAdjustments = { exposure: 0, contrast: 1, saturation: 1, focusSoftness: 0, warmth: 0, vibrance: 0, tint: 0, sharpen: 0, rotation: 0, cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0, depthBlur: 0 };
  const ranges: Record<keyof PhotoLabAdjustments, [number, number]> = {
    exposure: [-4, 4], contrast: [0.6, 1.6], saturation: [0, 1.8], focusSoftness: [0, 8], warmth: [-100, 100],
    vibrance: [-1, 1], tint: [-100, 100], sharpen: [0, 1], rotation: [0, 270], cropLeft: [0, .85], cropTop: [0, .85], cropRight: [0, .85], cropBottom: [0, .85], depthBlur: [0, 24],
  };
  const normalizedAdjustments = { ...defaults, ...adjustments } as Record<keyof PhotoLabAdjustments, unknown>;
  for (const [key, [min, max]] of Object.entries(ranges) as Array<[keyof PhotoLabAdjustments, [number, number]]>) {
    const item = normalizedAdjustments[key];
    if (typeof item !== "number" || !Number.isFinite(item) || item < min || item > max) {
      throw new Error(`Adjustment '${key}' must be between ${min} and ${max}.`);
    }
  }
  if (Number(normalizedAdjustments.rotation) % 90 !== 0) throw new Error("Rotation must be a multiple of 90 degrees.");
  if (!Number.isInteger(value.revision) || Number(value.revision) < 1) throw new Error("Recipe revision must be a positive integer.");
  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") throw new Error("Recipe timestamps are missing.");
  return {
    format: "lens-lab-photo-recipe", schemaVersion: 1, id: value.id, name: value.name.trim(),
    description: typeof value.description === "string" ? value.description : "",
    revision: Number(value.revision), createdAt: value.createdAt, updatedAt: value.updatedAt,
    image: { name: image.name, width: Number(image.width), height: Number(image.height), ...(typeof image.fingerprint === "string" ? { fingerprint: image.fingerprint } : {}) },
    mode: value.mode as CameraMode,
    cameraSettings: camera as unknown as CameraSettings,
    adjustments: normalizedAdjustments as unknown as PhotoLabAdjustments,
    history: Array.isArray(value.history) ? value.history.filter((entry): entry is string => typeof entry === "string").slice(-100) : [],
  };
}



/** Export a portable recipe bundle including the immutable snapshots, not only the current settings. */
export function serializePhotoRecipeRecord(record: PhotoRecipeRecord): string {
  const current = parsePhotoRecipe(record.currentText);
  const snapshots = record.versions.slice(-50).map((version) => {
    const document = parsePhotoRecipe(version.text);
    if (document.id !== record.id || document.revision !== version.revision) {
      throw new Error("Recipe history contains a mismatched revision and cannot be safely exported.");
    }
    return version;
  });
  if (!snapshots.some((version) => version.revision === current.revision)) {
    throw new Error("Current recipe revision is missing from its version history.");
  }
  return [
    "LENS LAB SHOT RECIPE — VERSIONED BUNDLE",
    "========================================",
    "# Includes the current settings and up to 50 immutable revision snapshots.",
    "# The original photograph is not embedded.",
    JSON.stringify({
      format: "lens-lab-shot-recipe-bundle",
      schemaVersion: 1,
      current,
      versions: snapshots,
    }, null, 2),
    "",
  ].join("\n");
}

/** Read a portable bundle or a legacy single-revision recipe text file. */
export function parsePhotoRecipeFile(text: string): { document: PhotoRecipeDocument; versions: PhotoRecipeVersion[] } {
  const MAX_BUNDLE_LENGTH = 1_000_000;
  if (typeof text !== "string" || !text.trim() || text.length > MAX_BUNDLE_LENGTH) {
    throw new Error("Recipe file is empty or exceeds the 1 MB safety limit.");
  }
  const start = text.indexOf("{");
  if (start < 0) throw new Error("Recipe file does not contain a settings block.");
  let raw: unknown;
  try { raw = JSON.parse(text.slice(start)); }
  catch { throw new Error("Recipe content is not valid JSON. Check the file and try again."); }
  if (!raw || typeof raw !== "object") throw new Error("Recipe content must be an object.");
  const value = raw as Record<string, unknown>;
  if (value.format === "lens-lab-photo-recipe") {
    const document = parsePhotoRecipe(text);
    return { document, versions: [{
      revision: document.revision,
      savedAt: Date.parse(document.updatedAt) || Date.now(),
      text: serializePhotoRecipe(document),
      summary: "Imported single-revision recipe",
    }] };
  }
  if (value.format !== "lens-lab-shot-recipe-bundle" || value.schemaVersion !== 1) {
    throw new Error("Unsupported recipe file or bundle schema version.");
  }
  const document = parsePhotoRecipe(JSON.stringify(value.current));
  if (!Array.isArray(value.versions) || value.versions.length < 1 || value.versions.length > 50) {
    throw new Error("Recipe bundle must contain between 1 and 50 revision snapshots.");
  }
  const versions = value.versions.map((item): PhotoRecipeVersion => {
    if (!item || typeof item !== "object") throw new Error("Recipe history entry is invalid.");
    const version = item as Record<string, unknown>;
    if (!Number.isInteger(version.revision) || Number(version.revision) < 1 ||
      typeof version.savedAt !== "number" || !Number.isFinite(version.savedAt) ||
      typeof version.text !== "string" || version.text.length > MAX_TEXT_LENGTH ||
      typeof version.summary !== "string") {
      throw new Error("Recipe history entry is missing valid revision, timestamp, text, or summary data.");
    }
    const snapshot = parsePhotoRecipe(version.text);
    if (snapshot.id !== document.id || snapshot.revision !== Number(version.revision)) {
      throw new Error("Recipe history entry does not match its parent recipe or revision number.");
    }
    return { revision: Number(version.revision), savedAt: Number(version.savedAt), text: version.text, summary: version.summary.slice(0, 240) };
  }).sort((a, b) => a.revision - b.revision);
  const unique = new Set(versions.map((version) => version.revision));
  if (unique.size !== versions.length || versions.at(-1)?.revision !== document.revision || !unique.has(document.revision)) {
    throw new Error("Recipe history has duplicate revisions or does not include the current revision.");
  }
  return { document, versions };
}

export function createPhotoRecipeRecord(document: PhotoRecipeDocument, summary = "Initial version"): PhotoRecipeRecord {
  const now = Date.now();
  const text = serializePhotoRecipe(document);
  return {
    id: document.id, name: document.name, description: document.description,
    createdAt: now, updatedAt: now, currentRevision: document.revision,
    currentText: text, versions: [{ revision: document.revision, savedAt: now, text, summary }],
  };
}

export function appendPhotoRecipeRevision(
  record: PhotoRecipeRecord,
  document: PhotoRecipeDocument,
  summary = "Settings updated",
): PhotoRecipeRecord {
  const revision = record.currentRevision + 1;
  const next = createPhotoRecipeDocument({
    ...document, id: record.id, name: record.name, description: record.description,
    revision, createdAt: new Date(record.createdAt).toISOString(),
    history: [...document.history, `Revision ${revision}: ${summary}`],
  });
  const text = serializePhotoRecipe(next);
  const now = Date.now();
  return {
    ...record, updatedAt: now, currentRevision: revision, currentText: text,
    versions: [...record.versions, { revision, savedAt: now, text, summary }].slice(-50),
  };
}

export function restorePhotoRecipeRevision(record: PhotoRecipeRecord, revision: number): PhotoRecipeRecord {
  const version = record.versions.find((item) => item.revision === revision);
  if (!version) throw new Error("The selected recipe revision is no longer available.");
  const document = parsePhotoRecipe(version.text);
  return appendPhotoRecipeRevision(record, document, `Restored from revision ${revision}`);
}
