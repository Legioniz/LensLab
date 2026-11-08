import type { CameraMode, CameraSettings } from "./camera";
import type { PhotoLabAdjustments } from "../engine/photoLab";

export interface PhotoRecipeDocument {
  format: "lens-lab-photo-recipe";
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  image: { name: string; width: number; height: number; fingerprint?: string };
  mode: CameraMode;
  cameraSettings: CameraSettings;
  adjustments: PhotoLabAdjustments;
  history: string[];
}

export interface PhotoRecipeVersion {
  revision: number;
  savedAt: number;
  text: string;
  summary: string;
}

export interface PhotoRecipeRecord {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  currentRevision: number;
  currentText: string;
  versions: PhotoRecipeVersion[];
}
