import { create } from "zustand";
import type { CameraMode, CameraSettings, CaptureRecord, UserPreferences } from "../types/camera";

export const initialSettings: CameraSettings = {
  aperture: 5.6,
  shutter: 1 / 60,
  iso: 400,
  focalLength: 50,
  focusDistance: 2.5,
  exposureCompensation: 0,
  focusMode: "AF-S",
};

export const initialPreferences: UserPreferences = {
  soundEnabled: true,
  soundVolume: 0.65,
  animationsEnabled: true,
  theme: "dark",
  showGrid: true,
  showHints: true,
  quality: "balanced",
};

const readPreferences = (): UserPreferences => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("lenslab-preferences-v1") || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return initialPreferences;
    const value = saved as Partial<UserPreferences>;
    return {
      soundEnabled: typeof value.soundEnabled === "boolean" ? value.soundEnabled : initialPreferences.soundEnabled,
      soundVolume: typeof value.soundVolume === "number" && Number.isFinite(value.soundVolume) ? Math.max(0, Math.min(1, value.soundVolume)) : initialPreferences.soundVolume,
      animationsEnabled: typeof value.animationsEnabled === "boolean" ? value.animationsEnabled : initialPreferences.animationsEnabled,
      theme: value.theme === "light" || value.theme === "dark" ? value.theme : initialPreferences.theme,
      showGrid: typeof value.showGrid === "boolean" ? value.showGrid : initialPreferences.showGrid,
      showHints: typeof value.showHints === "boolean" ? value.showHints : initialPreferences.showHints,
      quality: value.quality === "eco" || value.quality === "balanced" || value.quality === "high" ? value.quality : initialPreferences.quality,
    };
  } catch { return initialPreferences; }
};

type Store = {
  settings: CameraSettings;
  sceneId: string;
  cameraProfileId: string;
  lensProfileId: string;
  mode: CameraMode;
  preferences: UserPreferences;
  captures: CaptureRecord[];
  setSetting: <K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) => void;
  setSettings: (settings: CameraSettings) => void;
  setScene: (sceneId: string) => void;
  setCameraProfile: (id: string) => void;
  setLensProfile: (id: string) => void;
  setMode: (mode: CameraMode) => void;
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  setCaptures: (captures: CaptureRecord[]) => void;
  addCapture: (capture: CaptureRecord) => void;
  removeCapture: (id: string) => void;
  resetSettings: () => void;
};

export const useCameraStore = create<Store>((set) => ({
  settings: initialSettings,
  sceneId: "portrait",
  cameraProfileId: "canon-eos-3000d-reference",
  lensProfileId: "generic-18-55",
  mode: "M",
  preferences: readPreferences(),
  captures: [],
  setSetting: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),
  setSettings: (settings) => set({ settings }),
  setScene: (sceneId) => set({ sceneId }),
  setCameraProfile: (cameraProfileId) => set({ cameraProfileId }),
  setLensProfile: (lensProfileId) => set({ lensProfileId }),
  setMode: (mode) => set({ mode }),
  setPreference: (key, value) => set((state) => {
    const preferences = { ...state.preferences, [key]: value };
    try { localStorage.setItem("lenslab-preferences-v1", JSON.stringify(preferences)); } catch { /* Preferences still apply for this session if storage is blocked. */ }
    return { preferences };
  }),
  setCaptures: (captures) => set({ captures }),
  addCapture: (capture) => set((state) => ({ captures: [capture, ...state.captures] })),
  removeCapture: (id) => set((state) => ({ captures: state.captures.filter((item) => item.id !== id) })),
  resetSettings: () => set({ settings: initialSettings, mode: "M", sceneId: "portrait", cameraProfileId: "canon-eos-3000d-reference", lensProfileId: "generic-18-55" }),
}));
