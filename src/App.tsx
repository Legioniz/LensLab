import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import {
  Aperture, ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Camera, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, Download, Focus, Gauge, Grid2X2, Image as ImageIcon, Info,
  Lightbulb, Maximize2, Moon, Play, RotateCcw, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Sun, Timer, Volume2, VolumeX, X, Zap, BarChart3,
  Trash2, GraduationCap, FileText,
} from "lucide-react";
import SceneCanvas from "./components/SceneCanvas";
import PhotoLab from "./components/PhotoLab";
import PhotoPracticeLibrary from "./components/PhotoPracticeLibrary";
import LensComparisonLab from "./components/LensComparisonLab";
import PresetManager from "./components/PresetManager";
import DiagnosticsPanel from "./components/DiagnosticsPanel";
import GuidedTour, { type TourStep } from "./components/GuidedTour";
import { cameraProfiles, lensProfiles, validateCameraProfile, validateLensProfile } from "./engine/cameraProfiles";
import { calculateDepthOfField, calculateEv100, calculateExposureOffset, calculateMeterOffset, exposureLabel, formatShutter, applyAutoExposure, maxApertureAtFocal } from "./engine/exposure";
import { getScene, scenes } from "./engine/scenes";
import { createCaptureBlob } from "./engine/renderScene";
import { clearCaptures, deleteCapture as deleteStoredCapture, listCaptures, saveCapture } from "./storage/database";
import { useCameraStore } from "./store/cameraStore";
import type { CameraMode, CameraSettings, CaptureRecord } from "./types/camera";
import { playSound, type SoundKind } from "./utils/sound";
import { logError, logInfo, logWarn } from "./utils/logger";
import type { PresetDocument } from "./types/preset";

const apertureStops = [1.8, 2, 2.2, 2.8, 3.2, 3.5, 4, 4.5, 5.6, 6.3, 8, 9, 11, 13, 16, 18, 22];
const shutterStops = [30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3.2, 2.5, 2, 1.6, 1.3, 1, 1 / 1.3, 1 / 1.6, 1 / 2, 1 / 2.5, 1 / 3.2, 1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40, 1 / 50, 1 / 60, 1 / 80, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400, 1 / 500, 1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500, 1 / 3200, 1 / 4000, 1 / 5000, 1 / 6400, 1 / 8000];

type Tab = "studio" | "practice" | "photo-lab" | "lens-lab" | "presets" | "gallery" | "analysis" | "academy" | "settings";

function nearestIndex(values: number[], value: number) {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (Math.abs(values[i] - value) < Math.abs(values[best] - value)) best = i;
  return best;
}

function Control({
  label, value, values, onChange, icon, format, detail, disabled = false,
}: {
  label: string; value: number; values: number[]; onChange: (value: number) => void;
  icon: ReactNode; format: (value: number) => string; detail: string; disabled?: boolean;
}) {
  const index = nearestIndex(values, value);
  return (
    <div className={`control-card ${disabled ? "control-disabled" : ""}`}>
      <div className="control-top">
        <span className="control-label">{icon}{label}</span>
        <span className="control-value">{format(value)}</span>
      </div>
      <input aria-label={label} type="range" min={0} max={values.length - 1} step={1} value={index} disabled={disabled}
        onChange={(event) => onChange(values[Number(event.target.value)])} />
      <div className="control-bottom"><span>{detail}</span><span>{index + 1}/{values.length}</span></div>
    </div>
  );
}

function Meter({ offset }: { offset: number }) {
  const bounded = Math.max(-3, Math.min(3, offset));
  const status = exposureLabel(offset);
  return (
    <div className="meter-panel">
      <div className="meter-title"><Sun size={15} /> EXPOSURE METER <span>SCENE-REFERENCED · STOP SCALE</span></div>
      <div className="meter-track">
        <div className="meter-center" />
        <div className="meter-indicator" style={{ left: `${((bounded + 3) / 6) * 100}%` }} />
        <div className="meter-ticks"><span>−3</span><span>−2</span><span>−1</span><span>0</span><span>+1</span><span>+2</span><span>+3</span></div>
      </div>
      <div className={`meter-status ${Math.abs(offset) < .25 ? "balanced" : offset > 0 ? "over" : "under"}`}>
        <span className="meter-dot" />{status.toUpperCase()} <span className="meter-reading">{offset > 0 ? "+" : ""}{offset.toFixed(2)} STOPS</span>
      </div>
    </div>
  );
}

function Histogram({ values }: { values: number[] }) {
  return (
    <div className="histogram" aria-label="Live luminance histogram">
      {values.map((value, index) => <span key={index} style={{ height: `${Math.max(3, value * 100)}%` }} />)}
    </div>
  );
}

function Startup({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="startup-screen">
      <div className="startup-orbit orbit-one" /><div className="startup-orbit orbit-two" />
      <div className="startup-center">
        <div className="startup-aperture"><Aperture size={48} strokeWidth={1.2} /></div>
        <div className="startup-wordmark">LENS<span>LAB</span></div>
        <div className="startup-tagline">LEARN THE LIGHT. MASTER THE FRAME.</div>
        <div className="startup-loading"><span /></div>
        <div className="startup-initializing">INITIALIZING LOCAL CAMERA SYSTEM</div>
        <button className="startup-skip" onClick={onComplete}>SKIP INTRO <ArrowRight size={13}/></button>
      </div>
      <div className="startup-footer"><span>LOCAL-FIRST PHOTOGRAPHY STUDIO</span><span>BUILD 0.5.1 · EDUCATIONAL SIMULATION</span></div>
    </div>
  );
}

function CaptureModal({ capture, onClose, onDownload }: { capture: CaptureRecord; onClose: () => void; onDownload: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="capture-modal modal-card">
        <button className="modal-close" onClick={onClose} aria-label="Close capture details"><X size={18}/></button>
        <img src={capture.previewUrl} alt={`${capture.sceneName} capture`} />
        <div className="capture-modal-info">
          <div><div className="section-kicker">CAPTURE DETAILS</div><h2>{capture.sceneName}</h2></div>
          <div className="capture-modal-stats"><span>f/{capture.settings.aperture.toFixed(1)}</span><span>{formatShutter(capture.settings.shutter)}</span><span>ISO {capture.settings.iso}</span><span>{capture.settings.focalLength}mm</span></div>
          <p>{capture.cameraManufacturer} {capture.cameraModel} · {capture.lensModel}</p>
          <p>EV100 {capture.ev100.toFixed(2)} · Scene {capture.sceneEv100.toFixed(2)} · {capture.exposureOffset > 0 ? "+" : ""}{capture.exposureOffset.toFixed(2)} stops · {capture.renderQuality.toUpperCase()} · {new Date(capture.createdAt).toLocaleString()}</p>
          <button className="primary-button" onClick={onDownload}><Download size={15}/> DOWNLOAD IMAGE</button>
        </div>
      </section>
    </div>
  );
}

const lessons = [
  { id: "triangle", title: "The exposure triangle", time: "6 MIN", level: "FOUNDATION", text: "Aperture, shutter speed, and ISO are three controls that jointly determine exposure. Changing one can be balanced by changing another.", task: "In Manual mode, keep the meter near zero while making three equivalent exposures. For the wider-aperture example, switch to the illustrative 50mm prime lens profile. Compare equivalent settings while keeping ISO constant." },
  { id: "aperture", title: "Aperture and depth", time: "5 MIN", level: "OPTICS", text: "Aperture controls the size of the lens opening. A lower f-number is a wider opening, gathers more light, and usually produces shallower depth of field.", task: "Choose Portrait study. Switch to the illustrative 50mm prime profile, then compare f/2, f/5.6, and f/11 while keeping focus distance and framing unchanged." },
  { id: "shutter", title: "Shutter speed and motion", time: "5 MIN", level: "MOTION", text: "Shutter speed controls how long light reaches the sensor. Fast exposures can freeze motion; slower exposures record movement over time.", task: "Choose Action study. Compare 1/1000s, 1/250s, and 1/30s. Watch how the subject motion approximation changes." },
  { id: "iso", title: "ISO and image quality", time: "4 MIN", level: "SENSOR", text: "ISO changes the amplification applied to the captured signal. Higher ISO helps in low light but generally reduces image quality through increased visible noise and reduced highlight headroom.", task: "Choose Neon after dark. Compare ISO 400, 1600, and 6400, then inspect the shadow areas." },
  { id: "histogram", title: "Reading a histogram", time: "4 MIN", level: "ANALYSIS", text: "A histogram shows the distribution of image tones. Left represents darker values, right represents brighter values. Clipping occurs when detail is lost at either extreme.", task: "Move exposure compensation from −2 to +2 stops and watch the histogram shift." },
];

const TOUR_STEPS: TourStep[] = [
  { tab: "studio", selector: '[data-guide="viewfinder"]', title: "Your live viewfinder", description: "This is the simulated camera image. It reacts to exposure, focus, lens, and quality settings. The overlay shows your current shooting values.", action: "This is where your camera settings appear as a live preview." },
  { tab: "studio", selector: '[data-guide="camera-controls"]', title: "Control the exposure triangle", description: "Aperture, shutter speed, and ISO work together. The shooting mode determines which values you control and which the simulator calculates.", action: "Try Manual first, then compare Av and Tv." },
  { tab: "studio", selector: '[data-guide="scene-library"]', title: "Choose a lighting situation", description: "Each bundled scene has a target brightness, subject distance, and motion hint. Use the scene library to practice in different conditions.", action: "Switch scenes to understand how one setting behaves in different light." },
  { tab: "studio", selector: '[data-guide="sidebar-toggle"]', title: "Make room when you need it", description: "Collapse navigation to give your workspace more room. The > handle remains visible at the edge so you can reopen the sidebar at any time.", action: "After the guide, use the chevron to hide and restore navigation at any time." },
  { tab: "photo-lab", selector: '[data-guide="photo-upload"]', title: "Experiment with your own photos", description: "Photo Lab imports JPEG, PNG, and WebP files locally. Your original is preserved. The compact editor keeps the photograph in the center with controls beside it.", action: "Drop a photo or choose one from your device." },
  { tab: "photo-lab", selector: '[data-guide="photo-inspector"]', title: "Adjust without losing the image", description: "Use the inspector for camera response, image adjustments, undo/redo, and versioned shot recipes. Hide the inspector when you want a larger image view.", action: "Use WIPE to compare the original with your current result." },
  { tab: "lens-lab", selector: '.lens-comparison-page', title: "Compare lens behavior", description: "Compare supported lens profiles using your selected camera sensor. Change the focal length, aperture, and focus distance to see field of view and depth-of-field estimates.", action: "Treat the values as optical estimates and verify them against your real lens specifications." },
  { tab: "presets", selector: '[data-guide="preset-manager"]', title: "Save repeatable camera setups", description: "Presets are readable TXT snapshots. Create, load, update, import, export, delete, inspect history, or restore an earlier version.", action: "Save useful settings as a versioned preset." },
  { tab: "gallery", selector: '[data-guide="gallery-heading"]', title: "Review your captures", description: "The Gallery keeps generated JPEGs and Photo Lab results in browser storage. Inspect metadata, download files, and remove captures you no longer need.", action: "Export important images before clearing browser data." },
  { tab: "academy", selector: '[data-guide="academy-intro"]', title: "Learn the reasoning behind the settings", description: "Lessons explain the theory and give you a practical experiment to run in the Studio. Completion is remembered locally.", action: "Use each lesson as a short guided practice session." },
  { tab: "practice", selector: '[data-guide="photo-practice-intro"]', title: "Study real photographs", description: "Browse five real reference photographs for each simulator scene. Open a photo to see a composition or exposure exercise and a suggested starting point.", action: "Use the exercise to predict your settings, then open the matching Studio scene." },
  { tab: "settings", selector: '[data-guide="settings-appearance"]', title: "Choose your workspace theme", description: "Switch between the bright studio theme and the dark editing theme. The interface panels, controls, borders, and text adapt together; your photograph preview keeps its natural colors.", action: "Choose the theme that stays comfortable in your working environment." },
  { tab: "settings", selector: '[data-guide="settings-experience"]', title: "Tune sounds and motion", description: "Use quiet, synthesized sounds for navigation, controls, toggles, focus, and the virtual shutter. Adjust the volume or disable sounds completely. Motion can also be disabled independently.", action: "Keep sounds subtle and turn down motion when you need a distraction-free workspace." },
  { tab: "settings", selector: '[data-guide="settings-performance"]', title: "Tune performance and diagnostics", description: "Choose Eco, Balanced, or High rendering; reduce motion; search runtime logs; and export a diagnostic .log file when troubleshooting.", action: "Keep Balanced for everyday use and export logs when reporting a problem." },
  { tab: "settings", selector: '[data-guide="replay-guide"]', title: "Replay this guide any time", description: "The first-run guide does not interrupt you again after completion or dismissal. Use this control to bring it back whenever you want a quick refresher.", action: "You can also press ? from anywhere outside a text field to reopen the visual tour." },
];

export default function App() {
  const settings = useCameraStore((s) => s.settings);
  const sceneId = useCameraStore((s) => s.sceneId);
  const mode = useCameraStore((s) => s.mode);
  const cameraProfileId = useCameraStore((s) => s.cameraProfileId);
  const lensProfileId = useCameraStore((s) => s.lensProfileId);
  const preferences = useCameraStore((s) => s.preferences);
  const captures = useCameraStore((s) => s.captures);
  const setSetting = useCameraStore((s) => s.setSetting);
  const setSettings = useCameraStore((s) => s.setSettings);
  const setScene = useCameraStore((s) => s.setScene);
  const setMode = useCameraStore((s) => s.setMode);
  const setPreference = useCameraStore((s) => s.setPreference);
  const setCaptures = useCameraStore((s) => s.setCaptures);
  const addCapture = useCameraStore((s) => s.addCapture);
  const removeCapture = useCameraStore((s) => s.removeCapture);
  const setCameraProfile = useCameraStore((s) => s.setCameraProfile);
  const setLensProfile = useCameraStore((s) => s.setLensProfile);

  const scene = getScene(sceneId);
  const camera = cameraProfiles.find((profile) => profile.id === cameraProfileId) ?? cameraProfiles[0];
  const lens = lensProfiles.find((profile) => profile.id === lensProfileId) ?? lensProfiles[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<Tab>("studio");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("lenslab-sidebar-collapsed-v1") === "1"; }
    catch { return false; }
  });
  const [booted, setBooted] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourInitialized, setTourInitialized] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [histogram, setHistogram] = useState<number[]>(Array(32).fill(0));
  const [selectedCapture, setSelectedCapture] = useState<CaptureRecord | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("lenslab-lessons-v1") || "[]");
      return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string" && lessons.some((lesson) => lesson.id === item)) : [];
    } catch { return []; }
  });
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const lastSliderSoundAt = useRef(0);

  const ev100 = useMemo(() => calculateEv100(settings), [settings]);
  const exposureOffset = useMemo(() => calculateExposureOffset(settings, scene), [settings, scene]);
  const meterOffset = useMemo(() => calculateMeterOffset(settings, scene), [settings, scene]);
  const depth = useMemo(() => calculateDepthOfField(settings.focalLength, settings.aperture, settings.focusDistance, camera), [settings, camera]);
  const cameraErrors = useMemo(() => [...validateCameraProfile(camera), ...validateLensProfile(lens)], [camera, lens]);
  const allowedApertures = apertureStops.filter((value) => value >= maxApertureAtFocal(lens, settings.focalLength) && value <= lens.minAperture);
  const availableShutterStops = shutterStops.filter((value) => value >= camera.shutterMin && value <= camera.shutterMax);
  const dofNear = depth.nearM.toFixed(2);
  const dofFar = Number.isFinite(depth.farM) ? `${depth.farM.toFixed(2)}m` : "∞";

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setBooted(true), preferences.animationsEnabled && !reduceMotion ? 950 : 0);
    return () => window.clearTimeout(timer);
  }, [preferences.animationsEnabled]);

  useEffect(() => {
    if (!booted || tourInitialized) return;
    setTourInitialized(true);
    try {
      const guideState = localStorage.getItem("lenslab-visual-guide-v1");
      if (!guideState) {
        // Users who already dismissed the older welcome dialog are not prompted again.
        if (localStorage.getItem("lenslab-welcomed-v1")) localStorage.setItem("lenslab-visual-guide-v1", "dismissed");
        else { setTourStep(0); setTab(TOUR_STEPS[0].tab); }
      }
    } catch { logWarn("onboarding", "Could not read first-run guide preference; guide will remain session-only."); setTourStep(0); }
    logInfo("startup", "LENS LAB interface initialized", { version: "0.5.1" });
  }, [booted, tourInitialized]);

  useEffect(() => {
    let alive = true;
    const createdUrls: string[] = [];
    listCaptures().then((stored) => {
      if (!alive) return;
      // Merge rather than replace: a slow initial read must not erase a capture made during startup.
      const current = useCameraStore.getState().captures;
      const currentById = new Map(current.map((capture) => [capture.id, capture]));
      const merged = stored.map((capture) => {
        const existing = currentById.get(capture.id);
        if (existing) return existing;
        const previewUrl = URL.createObjectURL(capture.imageBlob);
        createdUrls.push(previewUrl);
        return { ...capture, previewUrl };
      });
      const storedIds = new Set(stored.map((capture) => capture.id));
      for (const capture of current) if (!storedIds.has(capture.id)) merged.unshift(capture);
      setCaptures(merged);
    }).catch((reason: unknown) => {
      logError("storage", "Capture storage could not be initialized", reason);
      setError("Local capture storage could not be opened. Try a current browser or review the storage permissions.");
    });
    return () => {
      alive = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [setCaptures]);


  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        const width = canvas.width;
        const height = canvas.height;
        const sample = context.getImageData(0, 0, width, height).data;
        const bins = Array(32).fill(0) as number[];
        const stride = 28;
        let count = 0;
        for (let i = 0; i < sample.length; i += 4 * stride) {
          const luminance = 0.2126 * sample[i] + 0.7152 * sample[i + 1] + 0.0722 * sample[i + 2];
          bins[Math.min(31, Math.floor(luminance / 8))] += 1;
          count += 1;
        }
        const max = Math.max(1, ...bins);
        setHistogram(bins.map((value) => value / max));
      } catch { /* A browser may deny pixel access; the rest of the simulator remains usable. */ }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [settings, scene, preferences.quality]);

  useEffect(() => {
    document.documentElement.classList.toggle("no-motion", !preferences.animationsEnabled);
  }, [preferences.animationsEnabled]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.colorScheme = preferences.theme;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = preferences.theme === "light" ? "#f2f5f8" : "#0c1015";
  }, [preferences.theme]);

  useEffect(() => {
    try { localStorage.setItem("lenslab-sidebar-collapsed-v1", sidebarCollapsed ? "1" : "0"); }
    catch { logWarn("workspace", "Could not persist sidebar preference; it will reset next session."); }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => { logError("window", event.message || "Uncaught browser error", { source: event.filename, line: event.lineno, column: event.colno, stack: event.error?.stack }); playSound("error", preferences.soundEnabled, preferences.soundVolume); };
    const onRejection = (event: PromiseRejectionEvent) => { logError("promise", "Unhandled promise rejection", event.reason); playSound("error", preferences.soundEnabled, preferences.soundVolume); };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, [preferences.soundEnabled, preferences.soundVolume]);

  const play = useCallback((kind: SoundKind) => playSound(kind, preferences.soundEnabled, preferences.soundVolume), [preferences.soundEnabled, preferences.soundVolume]);

  const handleAppClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!preferences.soundEnabled) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLElement>('button, [role="button"], [role="switch"]');
    if (!control || control.matches(':disabled, [aria-disabled="true"]') || control.dataset.sound === "off") return;
    // The virtual shutter already has a dedicated sound after the capture succeeds.
    if (control.classList.contains("shutter-button")) return;
    const requested = control.dataset.sound as SoundKind | undefined;
    const kind: SoundKind = requested || (
      control.matches(".nav-item") ? "navigation" :
      control.matches('[role="switch"], .toggle, [aria-pressed]') ? "toggle" :
      control.matches(".danger-button, .danger-icon") ? "warning" :
      control.matches(".primary-button") ? "click" :
      control.matches(".icon-button") ? "toggle" : "click"
    );
    playSound(kind, true, preferences.soundVolume);
  }, [preferences.soundEnabled, preferences.soundVolume]);

  const handleAppChangeCapture = useCallback((event: ChangeEvent<HTMLDivElement>) => {
    if (!preferences.soundEnabled) return;
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      playSound("toggle", true, preferences.soundVolume);
      return;
    }
    if (!(target instanceof HTMLInputElement) || target.type !== "range") return;
    const now = performance.now();
    if (now - lastSliderSoundAt.current < 72) return;
    lastSliderSoundAt.current = now;
    const requested = target.dataset.sound as SoundKind | undefined;
    playSound(requested ?? "slider", true, preferences.soundVolume);
  }, [preferences.soundEnabled, preferences.soundVolume]);

  function advanceTour() {
    if (tourStep === null) return;
    const next = tourStep + 1;
    if (next >= TOUR_STEPS.length) {
      setTourStep(null);
      try { localStorage.setItem("lenslab-visual-guide-v1", "completed"); } catch { /* Session still remembers this until it closes. */ }
      logInfo("onboarding", "Visual guide completed"); play("success"); return;
    }
    setTourStep(next);
    setTab(TOUR_STEPS[next].tab);
   
  }

  function skipTour() {
    setTourStep(null);
    try { localStorage.setItem("lenslab-visual-guide-v1", "dismissed"); } catch { /* Session-only dismissal. */ }
    logInfo("onboarding", "Visual guide dismissed by user");
   
  }

  function updateSetting<K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) {
    let next = { ...settings, [key]: value };
    if (key === "focalLength") next.aperture = Math.max(next.aperture, maxApertureAtFocal(lens, Number(value)));
    if (mode !== "M") next = applyAutoExposure(next, mode, scene, camera, lens);
    setSettings(next);
  }

  function selectScene(id: string) {
    const nextScene = getScene(id);
    setScene(id);
    const compatibleFocal = Math.max(lens.focalMinMm, Math.min(lens.focalMaxMm, nextScene.recommended.focalLength));
    const nextSettings: CameraSettings = { ...settings, ...nextScene.recommended, focalLength: compatibleFocal, aperture: Math.max(nextScene.recommended.aperture, maxApertureAtFocal(lens, compatibleFocal)) };
    setSettings(mode === "M" ? nextSettings : applyAutoExposure(nextSettings, mode, nextScene, camera, lens));
   
  }

  function selectMode(nextMode: CameraMode) {
    setMode(nextMode);
    if (nextMode !== "M") setSettings(applyAutoExposure(settings, nextMode, scene, camera, lens));
   
  }

  async function capturePhoto() {
    if (captureBusy) return;
    setCaptureBusy(true); setError("");
    try {
      const blob = await createCaptureBlob(scene, settings, camera, preferences.quality);
      const record: CaptureRecord = {
        id: crypto.randomUUID(), sceneId: scene.id, sceneName: scene.name, imageBlob: blob,
        settings: { ...settings }, ev100, exposureOffset, meterOffset, sceneEv100: scene.sceneEv100,
        cameraProfileId, lensProfileId, cameraManufacturer: camera.manufacturer, cameraModel: camera.model,
        lensModel: lens.model, renderQuality: preferences.quality, createdAt: Date.now(),
      };
      const persistent = await saveCapture(record);
      const item = { ...record, previewUrl: URL.createObjectURL(blob) };
      addCapture(item);
      play("shutter");
      setNotice(persistent ? "Capture saved to this device." : "Capture saved for this session only. Browser storage is unavailable; download a copy.");
      logInfo("capture", "Studio capture created", { id: record.id, scene: scene.id, persistent });
      window.setTimeout(() => setNotice(""), 3200);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Capture failed. Check browser storage permissions.";
      setError(message); logError("capture", "Studio capture failed", reason);
    } finally { setCaptureBusy(false); }
  }

  async function savePhotoLabCapture(blob: Blob, sourceName: string) {
    setError("");
    const record: CaptureRecord = {
      id: crypto.randomUUID(), sceneId: "photo-lab", sceneName: `Photo Lab · ${sourceName}`,
      imageBlob: blob, settings: { ...settings }, ev100, exposureOffset: 0, meterOffset: 0,
      sceneEv100: ev100, cameraProfileId, lensProfileId,
      cameraManufacturer: camera.manufacturer, cameraModel: camera.model, lensModel: lens.model,
      renderQuality: preferences.quality, createdAt: Date.now(),
    };
    const persistent = await saveCapture(record);
    addCapture({ ...record, previewUrl: URL.createObjectURL(blob) });
    setNotice(persistent ? "Processed photo saved to Gallery." : "Processed photo saved for this session only; export a copy for persistence.");
    logInfo("photo-lab", "Processed upload saved to gallery", { id: record.id, sourceName, persistent });
  }

  function applyPreset(document: PresetDocument) {
    const targetCamera = cameraProfiles.find((item) => item.id === document.cameraProfileId);
    const targetLens = lensProfiles.find((item) => item.id === document.lensProfileId);
    if (!targetCamera || !targetLens) {
      setError("This preset refers to a camera or lens profile that is not installed in this version. Import the matching profile or choose another preset.");
      logWarn("presets", "Preset references unavailable equipment profile", { cameraProfileId: document.cameraProfileId, lensProfileId: document.lensProfileId });
      return;
    }
    const targetScene = getScene(document.sceneId);
    const focalLength = Math.min(targetLens.focalMaxMm, Math.max(targetLens.focalMinMm, document.settings.focalLength));
    const normalized: CameraSettings = {
      ...document.settings,
      focalLength,
      aperture: Math.min(targetLens.minAperture, Math.max(maxApertureAtFocal(targetLens, focalLength), document.settings.aperture)),
      iso: targetCamera.isoValues[nearestIndex(targetCamera.isoValues, Math.max(targetCamera.isoMin, Math.min(targetCamera.isoMax, document.settings.iso)))],
      shutter: Math.max(targetCamera.shutterMin, Math.min(targetCamera.shutterMax, document.settings.shutter)),
      focusDistance: Math.max(targetLens.minFocusDistanceM, document.settings.focusDistance),
      exposureCompensation: Math.max(targetCamera.exposureCompensationMinEv, Math.min(targetCamera.exposureCompensationMaxEv, document.settings.exposureCompensation)),
    };
    setCameraProfile(targetCamera.id); setLensProfile(targetLens.id); setScene(targetScene.id); setMode(document.mode);
    setSettings(document.mode === "M" ? normalized : applyAutoExposure(normalized, document.mode, targetScene, targetCamera, targetLens));
    setTab("studio"); setNotice(`Loaded preset: ${document.name} · v${document.version}.`); play("success");
    logInfo("presets", "Preset applied to Studio", { name: document.name, version: document.version, camera: targetCamera.id, lens: targetLens.id });
  }

  async function deleteCapture(id: string) {
    const item = captures.find((capture) => capture.id === id);
    try {
      const persistent = await deleteStoredCapture(id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      removeCapture(id);
      if (selectedCapture?.id === id) setSelectedCapture(null);
      setNotice(persistent ? "Capture deleted." : "Capture hidden for this session; persistent browser storage could not be updated.");
      if (persistent) logInfo("gallery", "Capture deleted", { id });
      else logWarn("gallery", "Capture removed with session-only fallback", { id });
     
    } catch (reason) { setError("Could not delete this capture from local storage."); logError("gallery", "Capture deletion failed", reason); }
  }

  function downloadCapture(item: CaptureRecord) {
    const url = item.previewUrl || URL.createObjectURL(item.imageBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lens-lab-${item.sceneId}-${new Date(item.createdAt).toISOString().replace(/[:.]/g, "-")}.jpg`;
    link.click();
    if (!item.previewUrl) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
   
  }

  async function eraseGallery() {
    if (!window.confirm("Delete every saved LENS LAB capture from this browser? This cannot be undone.")) return;
    try {
      const persistent = await clearCaptures();
      captures.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
      setCaptures([]); setSelectedCapture(null);
      setNotice(persistent ? "Gallery cleared." : "Gallery cleared for this session. Browser storage could not confirm the permanent deletion; export important items before retrying.");
      if (persistent) logInfo("gallery", "Gallery cleared", { count: captures.length });
      else logWarn("gallery", "Gallery cleared with storage fallback", { count: captures.length });
     
    } catch { setError("The local gallery could not be cleared."); }
  }

  function exportManifest() {
    const manifest = captures.map(({ imageBlob: _blob, previewUrl: _url, ...metadata }) => metadata);
    const blob = new Blob([JSON.stringify({ app: "LENS LAB", schemaVersion: 1, exportedAt: new Date().toISOString(), captures: manifest }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "lens-lab-capture-manifest.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    play("success");
  }

  function toggleLesson(id: string) {
    const next = completedLessons.includes(id) ? completedLessons.filter((item) => item !== id) : [...completedLessons, id];
    setCompletedLessons(next);
    try { localStorage.setItem("lenslab-lessons-v1", JSON.stringify(next)); } catch { /* Progress remains active for this session if storage is blocked. */ }
    play("success");
  }

  function switchTab(nextTab: Tab) { setTab(nextTab); }

  function changeCameraProfile(id: string) {
    const profile = cameraProfiles.find((item) => item.id === id);
    if (!profile) return;
    setCameraProfile(id);
    const next = {
      ...settings,
      iso: profile.isoValues[nearestIndex(profile.isoValues, Math.max(profile.isoMin, Math.min(profile.isoMax, settings.iso)))],
      shutter: Math.max(profile.shutterMin, Math.min(profile.shutterMax, settings.shutter)),
      focusDistance: Math.max(lens.minFocusDistanceM, settings.focusDistance),
      aperture: Math.max(maxApertureAtFocal(lens, settings.focalLength), Math.min(lens.minAperture, settings.aperture)),
    };
    setSettings(mode === "M" ? next : applyAutoExposure(next, mode, scene, profile, lens));
   
  }

  function changeLensProfile(id: string) {
    const profile = lensProfiles.find((item) => item.id === id);
    if (!profile) return;
    setLensProfile(id);
    const next = { ...settings, focalLength: profile.focalMinMm, focusDistance: Math.max(profile.minFocusDistanceM, settings.focusDistance), aperture: Math.max(maxApertureAtFocal(profile, profile.focalMinMm), Math.min(profile.minAperture, settings.aperture)) };
    setSettings(mode === "M" ? next : applyAutoExposure(next, mode, scene, camera, profile));
   
  }

  const navItems: { id: Tab; label: string; icon: ReactNode; subtitle: string }[] = [
    { id: "studio", label: "Studio", icon: <Camera size={17}/>, subtitle: "Camera simulator" },
    { id: "practice", label: "Photo Practice", icon: <ImageIcon size={17}/>, subtitle: "25 reference photos" },
    { id: "photo-lab", label: "Photo Lab", icon: <ImageIcon size={17}/>, subtitle: "Test your photos" },
    { id: "lens-lab", label: "Lens Compare", icon: <Aperture size={17}/>, subtitle: "Compare optics" },
    { id: "presets", label: "Presets", icon: <FileText size={17}/>, subtitle: "Saved settings" },
    { id: "gallery", label: "Gallery", icon: <Grid2X2 size={17}/>, subtitle: `${captures.length} saved` },
    { id: "analysis", label: "Analysis", icon: <BarChart3 size={17}/>, subtitle: "Exposure diagnostics" },
    { id: "academy", label: "Academy", icon: <GraduationCap size={17}/>, subtitle: "Guides and practice" },
    { id: "settings", label: "Settings", icon: <Settings2 size={17}/>, subtitle: "Personalize studio" },
  ];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, button, select, textarea, [contenteditable=\"true\"]")) return;
      if (event.key === "?" && tourStep === null && !selectedCapture && !captureBusy) {
        event.preventDefault();
        setTab("studio");
        setTourStep(0);
        playSound("navigation", preferences.soundEnabled, preferences.soundVolume);
        return;
      }
      if (event.code !== "Space" || event.repeat || tab !== "studio" || tourStep !== null || selectedCapture || captureBusy) return;
      event.preventDefault();
      void capturePhoto();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab, tourStep, selectedCapture, captureBusy, settings, scene, camera, preferences.quality, preferences.soundEnabled, preferences.soundVolume]);

  if (!booted) return <Startup onComplete={() => setBooted(true)} />;

  return (
    <div className={`app-shell ${preferences.animationsEnabled ? "motion-on" : "motion-off"}`} onClickCapture={handleAppClickCapture} onChangeCapture={handleAppChangeCapture}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Aperture size={22} strokeWidth={1.6}/></div>
          <div><div className="brand-name">LENS<span>LAB</span></div><div className="brand-sub">PHOTOGRAPHY SIMULATION STUDIO</div></div>
        </div>
        <div className="top-context"><span className="live-dot"/> LOCAL SESSION <span className="top-divider"/> {camera.manufacturer.toUpperCase()} <span className="context-model">{camera.model.replace(" (reference profile)", "")}</span></div>
        <div className="top-actions">
          <span className="mode-pill">{mode} <span>{mode === "M" ? "MANUAL" : mode === "Av" ? "APERTURE" : mode === "Tv" ? "SHUTTER" : "PROGRAM"}</span></span>
          <button className="icon-button theme-toggle" title={`Switch to ${preferences.theme === "dark" ? "light" : "dark"} theme`} aria-label={`Switch to ${preferences.theme === "dark" ? "light" : "dark"} theme`} onClick={() => setPreference("theme", preferences.theme === "dark" ? "light" : "dark")}>{preferences.theme === "dark" ? <Sun size={17}/> : <Moon size={17}/>}</button>
          <button className="icon-button" title={preferences.soundEnabled ? "Mute interface sounds" : "Enable interface sounds"} aria-label="Toggle interface sounds" onClick={() => setPreference("soundEnabled", !preferences.soundEnabled)}>{preferences.soundEnabled ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button>
          <button className="icon-button" title="Open photography lessons and feature guide" aria-label="Open feature guide" onClick={() => switchTab("academy")}><CircleHelp size={17}/></button>
        </div>
      </header>

      <div className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${tab === "photo-lab" ? "photo-lab-active" : ""}`}>
        <aside className={`sidebar ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Show navigation sidebar" : "Hide navigation sidebar"} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed ? "Show navigation" : "Hide navigation"} data-guide="sidebar-toggle">
            {sidebarCollapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          </button>
          <div className="sidebar-section-label">WORKSPACE</div>
          <nav className="main-nav" aria-label="Main navigation">
            {navItems.map((item) => <button key={item.id} className={`nav-item ${tab === item.id ? "active" : ""}`} data-guide={`${item.id}-nav`} onClick={() => switchTab(item.id)}>
              <span className="nav-icon">{item.icon}</span><span className="nav-copy"><b>{item.label}</b><small>{item.subtitle}</small></span>{tab === item.id && <span className="nav-active-mark"/>}
            </button>)}
          </nav>
          <div className="sidebar-divider"/>
          <div className="sidebar-section-label">SCENE LIBRARY <span>{scenes.length.toString().padStart(2, "0")}</span></div>
          <div className="scene-list" data-guide="scene-library">
            {scenes.map((item) => <button key={item.id} className={`scene-option ${sceneId === item.id ? "selected" : ""}`} onClick={() => { selectScene(item.id); setTab("studio"); }}>
              <span className={`scene-thumb scene-${item.id}`}/><span className="scene-option-copy"><b>{item.name}</b><small>{item.category}</small></span>{sceneId === item.id && <span className="selected-dot"/>}
            </button>)}
          </div>
          <div className="sidebar-bottom">
            <div className="engine-status"><span className="online-dot"/> SIMULATION ENGINE <b>READY</b></div>
            <div className="local-badge"><ShieldCheck size={14}/> LOCAL DATA · PRIVATE</div>
          </div>
        </aside>

        <main className={`main-content ${tab === "photo-lab" ? "main-content-photo-lab" : ""}`}>
          {error && <div className="alert alert-error"><Info size={16}/><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15}/></button></div>}
          {notice && <div className="alert alert-success"><Check size={16}/>{notice}</div>}

          {tab === "practice" && <PhotoPracticeLibrary onTryScene={(id) => { selectScene(id); setTab("studio"); setNotice("Matching simulator scene loaded. The reference photo remains available in Photo Practice."); }} />}

          {tab === "studio" && <>
            <div className="page-heading studio-page-heading">
              <div><div className="section-kicker">VIRTUAL CAMERA · SHOOTING BAY 01</div><h1>Camera studio <span> / {scene.name}</span></h1><p>Adjust your settings. Watch the scene respond. Learn by doing.</p></div>
              <div className="heading-actions"><div className="quality-chip"><span className="quality-dot"/> {preferences.quality.toUpperCase()} RENDER</div><button className="subtle-button" onClick={() => { const focal = Math.max(lens.focalMinMm, Math.min(lens.focalMaxMm, scene.recommended.focalLength)); setSettings({ ...scene.recommended, focalLength: focal, aperture: Math.max(scene.recommended.aperture, maxApertureAtFocal(lens, focal)), exposureCompensation: 0, focusMode: "AF-S" }); setMode("M"); }}><RotateCcw size={14}/> RESET SCENE</button></div>
            </div>

            <div className="studio-grid">
              <section className="stage-column">
                <div className="stage-meta-row"><div className="stage-label"><span className="record-dot"/> LIVE VIEWFINDER <span className="stage-meta-divider"/> {scene.category}</div><div className="stage-meta-right"><span><Grid2X2 size={13}/> {preferences.showGrid ? "GRID ON" : "GRID OFF"}</span><span>3:2</span><span>{camera.sensorWidthMm.toFixed(1)} × {camera.sensorHeightMm.toFixed(1)}mm</span></div></div>
                <div className="viewfinder-shell" data-guide="viewfinder">
                  <SceneCanvas ref={canvasRef} settings={settings} scene={scene} camera={camera} quality={preferences.quality} showGrid={preferences.showGrid} animationsEnabled={preferences.animationsEnabled}/>
                  <div className="viewfinder-top"><span><span className="viewfinder-red-dot"/> REC READY</span><span>{settings.focalLength}mm · {settings.focusMode}</span></div>
                  <div className="viewfinder-left-label">{scene.name.toUpperCase()}</div>
                  <div className="viewfinder-bottom"><span>ISO {settings.iso}</span><span>F {settings.aperture.toFixed(1)}</span><span>{formatShutter(settings.shutter)}</span><span>EV {meterOffset > 0 ? "+" : ""}{meterOffset.toFixed(1)}</span></div>
                </div>
                <Meter offset={meterOffset}/>
                <div className="stage-insight-row">
                  <div className="insight-item"><Focus size={15}/><span>FOCUS DISTANCE</span><b>{settings.focusDistance.toFixed(1)}m</b></div>
                  <div className="insight-item"><Aperture size={15}/><span>EST. DEPTH</span><b>{dofNear}m – {dofFar}</b></div>
                  <div className="insight-item"><Gauge size={15}/><span>SCENE TARGET</span><b>EV {scene.sceneEv100.toFixed(1)}</b></div>
                </div>
                {preferences.showHints && <div className="scene-tip"><div className="tip-icon"><Lightbulb size={16}/></div><div><b>FIELD NOTE</b><p>{scene.tip}</p></div><button onClick={() => switchTab("academy")} aria-label="Open Academy"><ArrowRight size={16}/></button></div>}
              </section>

              <aside className="control-column" data-guide="camera-controls">
                <div className="control-panel-heading"><div><div className="section-kicker">EXPOSURE TRIANGLE</div><h2>Camera controls</h2></div><SlidersHorizontal size={18}/></div>
                <div className="mode-select-row"><label htmlFor="shooting-mode">SHOOTING MODE</label><div className="select-wrap"><select id="shooting-mode" value={mode} onChange={(event) => selectMode(event.target.value as CameraMode)}><option value="M">M · Manual</option><option value="Av">Av · Aperture priority</option><option value="Tv">Tv · Shutter priority</option><option value="P">P · Program</option></select><ChevronDown size={14}/></div></div>
                <div className="control-stack">
                  <Control label="APERTURE" value={settings.aperture} values={allowedApertures.length ? allowedApertures : apertureStops} onChange={(value) => updateSetting("aperture", value)} icon={<Aperture size={16}/>} format={(value) => `f/${value}`} detail="DEPTH OF FIELD" disabled={mode === "Tv" || mode === "P"}/>
                  <Control label="SHUTTER SPEED" value={settings.shutter} values={availableShutterStops.length ? availableShutterStops : shutterStops} onChange={(value) => updateSetting("shutter", value)} icon={<Timer size={16}/>} format={formatShutter} detail="MOTION CONTROL" disabled={mode === "Av" || mode === "P"}/>
                  <Control label="ISO SENSITIVITY" value={settings.iso} values={camera.isoValues} onChange={(value) => updateSetting("iso", value)} icon={<Zap size={16}/>} format={(value) => String(value)} detail="SENSOR GAIN"/>
                </div>
                <div className="minor-control-grid">
                  <div className="minor-control"><div><label htmlFor="focal-length">FOCAL LENGTH</label><b>{settings.focalLength}mm</b></div><input id="focal-length" data-sound="focus" type="range" min={lens.focalMinMm} max={lens.focalMaxMm} step={lens.focalMaxMm === lens.focalMinMm ? 1 : 1} value={Math.min(lens.focalMaxMm, Math.max(lens.focalMinMm, settings.focalLength))} disabled={lens.focalMaxMm === lens.focalMinMm} onChange={(event) => updateSetting("focalLength", Number(event.target.value))}/><div className="range-ends"><span>{lens.focalMinMm}mm</span><span>{lens.focalMaxMm}mm</span></div></div>
                  <div className="minor-control"><div><label htmlFor="focus-distance">FOCUS DISTANCE</label><b>{settings.focusDistance.toFixed(1)}m</b></div><input id="focus-distance" data-sound="focus" type="range" min={lens.minFocusDistanceM} max="35" step="0.1" value={settings.focusDistance} onChange={(event) => updateSetting("focusDistance", Number(event.target.value))}/><div className="range-ends"><span>{lens.minFocusDistanceM}m</span><span>35m</span></div></div>
                  <div className="minor-control exposure-comp"><div><label htmlFor="exposure-comp">EXPOSURE COMP.</label><b>{settings.exposureCompensation > 0 ? "+" : ""}{settings.exposureCompensation.toFixed(1)} EV</b></div><input id="exposure-comp" type="range" min={camera.exposureCompensationMinEv} max={camera.exposureCompensationMaxEv} step={camera.exposureCompensationStepEv} value={settings.exposureCompensation} onChange={(event) => updateSetting("exposureCompensation", Number(event.target.value))}/><div className="range-ends"><span>{camera.exposureCompensationMinEv}</span><span>+{camera.exposureCompensationMaxEv}</span></div></div>
                </div>
                <div className="quick-readout"><div><span>EV100</span><b>{ev100.toFixed(2)}</b></div><div><span>IMAGE DELTA</span><b className={exposureOffset > .25 ? "text-warn" : exposureOffset < -.25 ? "text-cool" : "text-good"}>{exposureOffset > 0 ? "+" : ""}{exposureOffset.toFixed(2)}</b></div><div><span>FOCUS MODE</span><div className="focus-select"><select aria-label="Focus mode" value={settings.focusMode} onChange={(event) => updateSetting("focusMode", event.target.value as CameraSettings["focusMode"])}><option>AF-S</option><option>AF-C</option><option>MF</option></select><ChevronDown size={12}/></div></div></div>
                <div className="capture-action-area"><button className={`shutter-button ${captureBusy ? "is-loading" : ""}`} onClick={capturePhoto} disabled={captureBusy}><span className="shutter-ring"><Camera size={19}/></span><span>{captureBusy ? "SAVING CAPTURE…" : "CAPTURE PHOTO"}</span><span className="shutter-key">SPACE</span></button><p><ShieldCheck size={13}/> Saved privately in this browser using IndexedDB.</p></div>
              </aside>
            </div>
            <div className="studio-bottom-grid">
              <div className="bottom-card histogram-card"><div className="bottom-card-heading"><div><span className="section-kicker">LIVE LUMINANCE</span><h3>Histogram</h3></div><span className="histogram-caption">SHADOWS <span/> HIGHLIGHTS</span></div><Histogram values={histogram}/><div className="histogram-axis"><span>0</span><span>64</span><span>128</span><span>192</span><span>255</span></div></div>
              <div className="bottom-card theory-card"><div className="bottom-card-heading"><div><span className="section-kicker">WHY IT LOOKS THIS WAY</span><h3>Simulation model</h3></div><Sparkles size={18}/></div><div className="theory-mini-grid"><div><b>Exposure</b><span>EV100 + scene target</span></div><div><b>Optics</b><span>Focal length + CoC</span></div><div><b>Sensor</b><span>ISO + noise model</span></div></div><button className="text-action" onClick={() => switchTab("analysis")}>OPEN TECHNICAL ANALYSIS <ArrowRight size={14}/></button></div>
            </div>
          </>}

          {tab === "photo-lab" && <PhotoLab
            settings={settings}
            mode={mode}
            quality={preferences.quality}
            apertureValues={allowedApertures.length ? allowedApertures : apertureStops}
            shutterValues={availableShutterStops.length ? availableShutterStops : shutterStops}
            isoValues={camera.isoValues}
            onCameraSetting={updateSetting}
            onApplyCameraSettings={(nextSettings, nextMode) => { setSettings(nextSettings); setMode(nextMode); }}
            onSavePreset={() => { setTab("presets"); }}
            onSaveCapture={savePhotoLabCapture}
          />}

          {tab === "lens-lab" && <LensComparisonLab lenses={lensProfiles} camera={camera}/>}

          {tab === "presets" && <PresetManager
            current={{ cameraProfileId, lensProfileId, mode, sceneId, settings }}
            onApply={applyPreset}
          />}

          {tab === "gallery" && <section className="content-page">
            <div className="page-heading" data-guide="gallery-heading"><div><div className="section-kicker">LOCAL CAPTURE STORAGE</div><h1>Capture gallery <span>/ {captures.length.toString().padStart(2, "0")}</span></h1><p>Your virtual photographs, settings, and shooting history.</p></div><div className="heading-actions"><button className="subtle-button" onClick={exportManifest} disabled={!captures.length}><FileText size={14}/> EXPORT MANIFEST</button><button className="subtle-button danger-button" onClick={eraseGallery} disabled={!captures.length}><Trash2 size={14}/> CLEAR GALLERY</button></div></div>
            {captures.length === 0 ? <div className="empty-state"><div className="empty-state-icon"><ImageIcon size={28}/></div><h2>Your gallery is waiting.</h2><p>Head to the Studio, adjust a few settings, then press the shutter to save your first capture.</p><button className="primary-button" onClick={() => switchTab("studio")}><Camera size={15}/> OPEN STUDIO</button></div> : <div className="gallery-grid">{captures.map((item) => <article className="gallery-card" key={item.id}><button className="gallery-image-button" onClick={() => setSelectedCapture(item)}><img src={item.previewUrl} alt={`Simulated ${item.sceneName} capture`} loading="lazy"/><span className="gallery-open"><Maximize2 size={15}/></span></button><div className="gallery-card-body"><div className="gallery-card-title"><b>{item.sceneName}</b><span>{new Date(item.createdAt).toLocaleDateString()}</span></div><div className="gallery-settings"><span>f/{item.settings.aperture.toFixed(1)}</span><span>{formatShutter(item.settings.shutter)}</span><span>ISO {item.settings.iso}</span></div><div className="gallery-card-actions"><button onClick={() => downloadCapture(item)}><Download size={13}/> DOWNLOAD</button><button onClick={() => deleteCapture(item.id)} aria-label={`Delete ${item.sceneName} capture`}><Trash2 size={13}/> DELETE</button></div></div></article>)}</div>}
            <div className="privacy-footnote"><ShieldCheck size={15}/> Captures are stored in this browser's IndexedDB. Clearing site data in your browser may permanently remove them. Download important images to keep a separate copy.</div>
          </section>}

          {tab === "analysis" && <section className="content-page">
            <div className="page-heading"><div><div className="section-kicker">PHOTOGRAPHIC DIAGNOSTICS</div><h1>Exposure analysis <span>/ LIVE</span></h1><p>Understand the mathematics behind the current preview.</p></div><button className="subtle-button" onClick={() => switchTab("studio")}><ArrowLeft size={14}/> BACK TO STUDIO</button></div>
            <div className="analysis-grid">
              <div className="analysis-card analysis-wide"><div className="bottom-card-heading"><div><span className="section-kicker">TONE DISTRIBUTION</span><h3>Live luminance histogram</h3></div><BarChart3 size={19}/></div><Histogram values={histogram}/><div className="histogram-axis"><span>BLACK · 0</span><span>MIDTONE · 128</span><span>WHITE · 255</span></div><p className="analysis-explainer">The histogram samples the rendered preview. A concentration against the far-left or far-right edge can indicate blocked shadows or clipped highlights. It is a visual diagnostic, not a RAW sensor histogram.</p></div>
              <div className="analysis-card"><span className="section-kicker">EXPOSURE MATHEMATICS</span><h3>EV100</h3><div className="large-metric">{ev100.toFixed(2)} <small>EV</small></div><div className="formula-box">EV100 = log₂(N² / t) − log₂(ISO / 100)</div><p>Calculated from your current aperture, shutter duration, and ISO. The scene target is {scene.sceneEv100.toFixed(2)} EV100.</p></div>
              <div className="analysis-card"><span className="section-kicker">METER INTERPRETATION</span><h3>{exposureLabel(meterOffset)}</h3><div className={`large-metric ${meterOffset > 0.25 ? "text-warn" : meterOffset < -0.25 ? "text-cool" : "text-good"}`}>{meterOffset > 0 ? "+" : ""}{meterOffset.toFixed(2)} <small>STOPS</small></div><p>This meter includes exposure compensation. The image exposure delta is {exposureOffset > 0 ? "+" : ""}{exposureOffset.toFixed(2)} stops relative to the scene reference.</p></div>
              <div className="analysis-card"><span className="section-kicker">DEPTH OF FIELD MODEL</span><h3>Focus range</h3><div className="dof-range"><div><span>NEAR LIMIT</span><b>{dofNear}m</b></div><div><span>FAR LIMIT</span><b>{dofFar}</b></div></div><div className="formula-box">H = f² / (N × c) + f</div><p>Approximation using {camera.model}, a {camera.circleOfConfusionMm.toFixed(3)}mm circle of confusion, {settings.focalLength}mm, and f/{settings.aperture.toFixed(1)}.</p></div>
              <div className="analysis-card"><span className="section-kicker">CAMERA PROFILE</span><h3>{camera.model}</h3><div className="profile-specs"><span>Sensor <b>{camera.sensorWidthMm} × {camera.sensorHeightMm}mm</b></span><span>Crop factor <b>{camera.cropFactor}×</b></span><span>ISO range <b>{camera.isoMin}–{camera.isoMax}</b></span><span>EC range <b>{camera.exposureCompensationMinEv > 0 ? "+" : ""}{camera.exposureCompensationMinEv} to +{camera.exposureCompensationMaxEv} EV</b></span><span>Shutter <b>30s–{formatShutter(camera.shutterMin)}</b></span></div><p className="profile-note">{cameraErrors.length ? cameraErrors.join(" ") : "Camera and lens profile validation: no structural issues detected."} Specifications are editable profile data, not an exhaustive camera compatibility guarantee.</p></div>
            </div>
          </section>}

          {tab === "academy" && <section className="content-page">
            <div className="page-heading"><div><div className="section-kicker">PRACTICE WITH PURPOSE</div><h1>Photography academy <span>/ FIELD GUIDE</span></h1><p>Short lessons with experiments you can run immediately in the Studio.</p></div><div className="academy-progress"><div><b>{completedLessons.length}/{lessons.length}</b><span>LESSONS COMPLETE</span></div><div className="progress-track"><span style={{ width: `${(completedLessons.length / lessons.length) * 100}%` }}/></div></div></div>
            <div className="academy-intro" data-guide="academy-intro"><div className="academy-intro-icon"><BookOpen size={22}/></div><div><span className="section-kicker">LEARN BY CHANGING THE SETTINGS</span><h2>Understand the image, not just the buttons.</h2><p>Each lesson includes a concept, a practical experiment, and a direct route back to the simulator.</p></div></div>
            <div className="lesson-grid">{lessons.map((lesson, index) => <article className={`lesson-card ${completedLessons.includes(lesson.id) ? "lesson-complete" : ""}`} key={lesson.id}><div className="lesson-card-top"><span className="lesson-number">0{index + 1}</span><span className="lesson-level">{lesson.level}</span>{completedLessons.includes(lesson.id) && <BadgeCheck size={17} className="lesson-check"/>}</div><h3>{lesson.title}</h3><p>{lesson.text}</p><div className="lesson-card-footer"><span><Clock3 size={13}/> {lesson.time}</span><button onClick={() => setActiveLesson(activeLesson === lesson.id ? null : lesson.id)}>{activeLesson === lesson.id ? "CLOSE GUIDE" : "OPEN LESSON"} <ArrowRight size={13}/></button></div>{activeLesson === lesson.id && <div className="lesson-expanded"><div className="section-kicker">PRACTICAL EXPERIMENT</div><p>{lesson.task}</p><div className="lesson-expanded-actions"><button className="primary-button" onClick={() => { setTab("studio"); if (lesson.id === "shutter") selectScene("motion"); else if (lesson.id === "iso") selectScene("night"); else if (lesson.id === "aperture") selectScene("portrait"); else if (lesson.id === "histogram") selectScene(sceneId); }}><Play size={13}/> TRY IN STUDIO</button><button className="text-action" onClick={() => toggleLesson(lesson.id)}>{completedLessons.includes(lesson.id) ? "MARK INCOMPLETE" : "MARK COMPLETE"} <Check size={13}/></button></div></div>}</article>)}</div>
            <div className="academy-disclaimer"><Lightbulb size={16}/> LENS LAB demonstrates simplified models. Real results also depend on lens design, lighting geometry, camera processing, subject reflectance, and technique.</div>
          </section>}

          {tab === "settings" && <section className="content-page">
            <div className="page-heading"><div><div className="section-kicker">PERSONALIZE YOUR WORKSPACE</div><h1>Studio settings <span>/ CONFIGURATION</span></h1><p>Choose the camera reference, visual behavior, and interface preferences.</p></div></div>
            <div className="settings-layout">
              <div className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Camera size={18}/></div><div><h3>Camera system</h3><p>Choose the camera body and lens reference that best match your equipment.</p></div></div><label className="settings-field">CAMERA BODY<select value={cameraProfileId} onChange={(event) => changeCameraProfile(event.target.value)}>{cameraProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.manufacturer} · {profile.model}</option>)}</select></label><label className="settings-field">LENS PROFILE<select value={lensProfileId} onChange={(event) => changeLensProfile(event.target.value)}>{lensProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.manufacturer} · {profile.model}</option>)}</select></label><div className="settings-info"><Info size={15}/> Lens profiles are generic teaching examples. Set the model and aperture range to match your own lens before treating the simulated constraints as camera-specific.</div></div>
              <div className="settings-card appearance-card" data-guide="settings-appearance"><div className="settings-card-heading"><div className="settings-icon"><Sun size={18}/></div><div><h3>Workspace appearance</h3><p>Choose a consistent light or dark surface across the entire interface.</p></div></div><div className="theme-options" role="group" aria-label="Workspace theme"><button type="button" className={`theme-option ${preferences.theme === "light" ? "selected" : ""}`} aria-pressed={preferences.theme === "light"} onClick={() => setPreference("theme", "light")}><span className="theme-swatch theme-swatch-light"><i/><i/><i/></span><span><b>Light studio</b><small>Bright surfaces · high-contrast text</small></span>{preferences.theme === "light" && <Check size={16}/>}</button><button type="button" className={`theme-option ${preferences.theme === "dark" ? "selected" : ""}`} aria-pressed={preferences.theme === "dark"} onClick={() => setPreference("theme", "dark")}><span className="theme-swatch theme-swatch-dark"><i/><i/><i/></span><span><b>Dark studio</b><small>Low-glare surfaces · muted chrome</small></span>{preferences.theme === "dark" && <Check size={16}/>}</button></div><p className="settings-inline-note">Photographs and the camera viewfinder retain their source colors; only application surfaces and controls change theme.</p></div>
              <div className="settings-card" data-guide="settings-experience"><div className="settings-card-heading"><div className="settings-icon"><Volume2 size={18}/></div><div><h3>Sound and motion</h3><p>Subtle feedback for navigation, controls, toggles, focus, and capture.</p></div></div><PreferenceRow title="Interface sound effects" description="Quiet synthesized feedback. No audio files or network requests." checked={preferences.soundEnabled} onChange={(checked) => { setPreference("soundEnabled", checked); if (checked) playSound("success", true, preferences.soundVolume); }}/><div className={`sound-volume-control ${!preferences.soundEnabled ? "is-disabled" : ""}`}><label htmlFor="sound-volume"><span>MASTER SOUND VOLUME</span><b>{Math.round(preferences.soundVolume * 100)}%</b></label><input id="sound-volume" type="range" min="0" max="1" step="0.05" value={preferences.soundVolume} disabled={!preferences.soundEnabled} onChange={(event) => setPreference("soundVolume", Number(event.target.value))}/><div className="sound-volume-ends"><span>QUIET</span><span>LOUDER</span></div></div><PreferenceRow title="Interface animations" description="Gentle transitions and micro-interactions. Disable for a static workspace." checked={preferences.animationsEnabled} onChange={(checked) => setPreference("animationsEnabled", checked)}/><PreferenceRow title="Rule-of-thirds grid" description="Show composition guides over the live viewfinder." checked={preferences.showGrid} onChange={(checked) => setPreference("showGrid", checked)}/><PreferenceRow title="Learning hints" description="Show contextual tips while practicing." checked={preferences.showHints} onChange={(checked) => setPreference("showHints", checked)}/></div>
              <div className="settings-card" data-guide="settings-performance"><div className="settings-card-heading"><div className="settings-icon"><Gauge size={18}/></div><div><h3>Rendering performance</h3><p>Choose a preview quality suited to your device.</p></div></div><div className="quality-options"><button className={preferences.quality === "eco" ? "selected" : ""} onClick={() => setPreference("quality", "eco")}><Moon size={16}/><b>Eco</b><small>Lower resolution, lighter effects</small></button><button className={preferences.quality === "balanced" ? "selected" : ""} onClick={() => setPreference("quality", "balanced")}><Gauge size={16}/><b>Balanced</b><small>Recommended everyday setting</small></button><button className={preferences.quality === "high" ? "selected" : ""} onClick={() => setPreference("quality", "high")}><Sparkles size={16}/><b>High</b><small>Sharper preview, more processing</small></button></div></div>
              <div className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><ShieldCheck size={18}/></div><div><h3>Local data and reset</h3><p>Your captures and learning progress are not uploaded.</p></div></div><div className="data-summary"><span>Saved captures <b>{captures.length}</b></span><span>Completed lessons <b>{completedLessons.length}/{lessons.length}</b></span><span>Storage mode <b>IndexedDB · This device</b></span></div><div className="settings-button-row"><button className="subtle-button" onClick={exportManifest} disabled={!captures.length}><FileText size={14}/> EXPORT METADATA</button><button className="subtle-button danger-button" onClick={() => { if (window.confirm("Reset camera settings and return to the portrait studio? Your saved captures will remain.")) { useCameraStore.getState().resetSettings(); } }}><RotateCcw size={14}/> RESET CAMERA</button></div><p className="settings-warning">Browser storage can be erased when site data is cleared. Download your captures regularly. The metadata export does not contain the image files; download images from Gallery separately.</p></div>
            </div>
            <div className="settings-card guide-replay-card"><div className="settings-card-heading"><div className="settings-icon"><GraduationCap size={18}/></div><div><h3>Guided walkthrough</h3><p>Replay the visual tour whenever you need a refresher. It dims unrelated areas and highlights one feature at a time.</p></div></div><button className="subtle-button" data-guide="replay-guide" onClick={() => { setTab("studio"); setTourStep(0); }}><Play size={14}/> REPLAY VISUAL GUIDE</button></div>
            <DiagnosticsPanel />
            <div className="settings-footer-note"><ShieldCheck size={15}/> LENS LAB runs locally. No account, analytics service, or cloud connection is required by this build.</div>
          </section>}

          <footer className="app-footer"><span><b>LENS LAB</b> <span>— A PERSONAL PHOTOGRAPHY SIMULATION PROJECT</span></span><span>LOCAL BUILD · 0.5.1 <i/> ALL SYSTEMS {error ? "CHECK" : "READY"}</span></footer>
        </main>
      </div>
      {tourStep !== null && <GuidedTour step={TOUR_STEPS[tourStep]} index={tourStep} total={TOUR_STEPS.length} onNext={advanceTour} onSkip={skipTour}/>}
      {selectedCapture && <CaptureModal capture={selectedCapture} onClose={() => setSelectedCapture(null)} onDownload={() => downloadCapture(selectedCapture)}/>}
    </div>
  );
}

function PreferenceRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="preference-row"><div><b>{title}</b><small>{description}</small></div><button className={`toggle ${checked ? "on" : ""}`} role="switch" aria-checked={checked} aria-label={`Toggle ${title}`} onClick={() => onChange(!checked)}><span/></button></div>;
}
