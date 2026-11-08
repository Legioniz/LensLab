import type { CameraMode, CameraSettings } from "./camera";

export interface PresetDocument {
  format: "lens-lab-preset";
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  cameraProfileId: string;
  lensProfileId: string;
  mode: CameraMode;
  sceneId: string;
  settings: CameraSettings;
}

export interface PresetVersion {
  version: number;
  savedAt: number;
  text: string;
}

export interface PresetRecord {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  currentVersion: number;
  currentText: string;
  versions: PresetVersion[];
}
