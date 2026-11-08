export type CameraMode = "M" | "Av" | "Tv" | "P";
export type FocusMode = "AF-S" | "AF-C" | "MF";
export type QualityMode = "balanced" | "high" | "eco";

export interface CameraSettings {
  aperture: number;
  shutter: number;
  iso: number;
  focalLength: number;
  focusDistance: number;
  exposureCompensation: number;
  focusMode: FocusMode;
}

export interface CameraProfile {
  id: string;
  manufacturer: string;
  model: string;
  sensorWidthMm: number;
  sensorHeightMm: number;
  resolutionWidth: number;
  resolutionHeight: number;
  cropFactor: number;
  isoMin: number;
  isoMax: number;
  isoValues: number[];
  exposureCompensationMinEv: number;
  exposureCompensationMaxEv: number;
  exposureCompensationStepEv: number;
  shutterMin: number;
  shutterMax: number;
  exposureStep: number;
  circleOfConfusionMm: number;
}

export interface LensProfile {
  id: string;
  manufacturer: string;
  model: string;
  focalMinMm: number;
  focalMaxMm: number;
  maxAperture: number;
  maxApertureAtTele?: number;
  minAperture: number;
  minFocusDistanceM: number;
  stabilization: boolean;
}

export interface SceneDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  background: string;
  subject: string;
  sceneEv100: number;
  subjectDistanceM: number;
  motion: number;
  recommended: { aperture: number; shutter: number; iso: number; focalLength: number; focusDistance: number };
  tip: string;
}

export interface CaptureRecord {
  id: string;
  sceneId: string;
  sceneName: string;
  imageBlob: Blob;
  settings: CameraSettings;
  ev100: number;
  exposureOffset: number;
  meterOffset: number;
  sceneEv100: number;
  cameraProfileId: string;
  lensProfileId: string;
  cameraManufacturer: string;
  cameraModel: string;
  lensModel: string;
  renderQuality: QualityMode;
  createdAt: number;
  previewUrl?: string;
}

export interface UserPreferences {
  soundEnabled: boolean;
  soundVolume: number;
  animationsEnabled: boolean;
  theme: "dark" | "light";
  showGrid: boolean;
  showHints: boolean;
  quality: QualityMode;
}
