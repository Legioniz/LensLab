import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  Aperture, ArrowDownToLine, ArrowLeftRight, Check, ChevronLeft, ChevronRight,
  FileImage, FileText, ImagePlus, Minus, Plus, RotateCcw, Save, SlidersHorizontal,
  Sparkles, Trash2, Upload, Undo2, Redo2, X, RotateCw, Crop, Layers, Fingerprint, FileArchive,
} from "lucide-react";
import type { CameraMode, CameraSettings, QualityMode } from "../types/camera";
import type { PhotoRecipeRecord } from "../types/recipe";
import { getPhotoRenderGeometry, photoLabDownloadName, renderOriginalPhoto, renderUploadedPhoto, validatePhotoDimensions, validatePhotoFile, type PhotoLabAdjustments } from "../engine/photoLab";
import { appendPhotoRecipeRevision, createPhotoRecipeDocument, createPhotoRecipeRecord, parsePhotoRecipe, parsePhotoRecipeFile, restorePhotoRecipeRevision, serializePhotoRecipe, serializePhotoRecipeRecord } from "../engine/recipes";
import { deletePhotoRecipe, listPhotoRecipes, savePhotoRecipe } from "../storage/database";
import { logError, logInfo, logWarn } from "../utils/logger";
import { calculateRgbHistogram, readExif, sha256Fingerprint, type ExifMetadata, type RgbHistogram } from "../engine/photoAnalysis";
import { createZipStore } from "../engine/zipStore";

interface PhotoLabProps {
  settings: CameraSettings;
  mode: CameraMode;
  quality: QualityMode;
  apertureValues: number[];
  shutterValues: number[];
  isoValues: number[];
  onCameraSetting: <K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) => void;
  onApplyCameraSettings: (settings: CameraSettings, mode: CameraMode) => void;
  onSavePreset: () => void;
  onSaveCapture: (blob: Blob, sourceName: string) => Promise<void>;
}

type CompareMode = "wipe" | "original" | "edited";
type AdjustmentKey = keyof PhotoLabAdjustments;
const initialAdjustments: PhotoLabAdjustments = { exposure: 0, contrast: 1, saturation: 1, focusSoftness: 0, warmth: 0, vibrance: 0, tint: 0, sharpen: 0, rotation: 0, cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0, depthBlur: 0 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const shutterLabel = (value: number) => value >= 1 ? `${value}s` : `1/${Math.round(1 / value)}s`;
const nearestIndex = (values: number[], value: number) => values.reduce((best, item, index) => Math.abs(item - value) < Math.abs(values[best] - value) ? index : best, 0);

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PhotoLab({ settings, mode, quality, apertureValues, shutterValues, isoValues, onCameraSetting, onApplyCameraSettings, onSavePreset, onSaveCapture }: PhotoLabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const recipeInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const maskInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wipeDragging = useRef(false);
  const panDragging = useRef(false);
  const panOrigin = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const gestureStart = useRef<PhotoLabAdjustments | null>(null);
  const fileLoadSequence = useRef(0);
  const loadSequence = useRef(0);
  const maskLoadSequence = useRef(0);
  const renderSequence = useRef(0);
  const [fileName, setFileName] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [subjectMask, setSubjectMask] = useState<HTMLImageElement | null>(null);
  const [subjectMaskUrl, setSubjectMaskUrl] = useState<string | null>(null);
  const [exif, setExif] = useState<ExifMetadata | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [rgbHistogram, setRgbHistogram] = useState<RgbHistogram | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [baseline, setBaseline] = useState<CameraSettings | null>(null);
  const [adjustments, setAdjustments] = useState<PhotoLabAdjustments>(initialAdjustments);
  const [history, setHistory] = useState<PhotoLabAdjustments[]>([initialAdjustments]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [compareMode, setCompareMode] = useState<CompareMode>("wipe");
  const [wipePosition, setWipePosition] = useState(50);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [recipes, setRecipes] = useState<PhotoRecipeRecord[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    try { return localStorage.getItem("lenslab-photo-inspector-open-v1") !== "0"; }
    catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem("lenslab-photo-inspector-open-v1", inspectorOpen ? "1" : "0"); }
    catch { logWarn("photo-lab", "Could not persist inspector visibility preference."); }
  }, [inspectorOpen]);

  useEffect(() => {
    let active = true;
    listPhotoRecipes().then((items) => { if (active) setRecipes(items); }).catch((reason: unknown) => logError("photo-recipes", "Could not load photo recipes", reason));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sourceImage || !canvasRef.current || !originalCanvasRef.current || !baseline) return;
    const sequence = ++renderSequence.current;
    // Each render gets private canvases. An older worker can finish, but it cannot overwrite
    // the visible canvas after a newer render has been requested.
    const editedWorkCanvas = document.createElement("canvas");
    const originalWorkCanvas = document.createElement("canvas");
    const renderOptions = { quality, baseline, current: settings, adjustments: { ...adjustments }, subjectMask };
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          renderOriginalPhoto(sourceImage, originalWorkCanvas, { quality, adjustments });
          await renderUploadedPhoto(sourceImage, editedWorkCanvas, renderOptions);
          if (sequence !== renderSequence.current || !canvasRef.current || !originalCanvasRef.current) return;
          const editedTarget = canvasRef.current;
          const originalTarget = originalCanvasRef.current;
          editedTarget.width = editedWorkCanvas.width;
          editedTarget.height = editedWorkCanvas.height;
          originalTarget.width = originalWorkCanvas.width;
          originalTarget.height = originalWorkCanvas.height;
          const editedContext = editedTarget.getContext("2d");
          const originalContext = originalTarget.getContext("2d");
          if (!editedContext || !originalContext) throw new Error("The preview canvas could not be updated.");
          editedContext.drawImage(editedWorkCanvas, 0, 0);
          originalContext.drawImage(originalWorkCanvas, 0, 0);
          setError("");
          try {
            setRgbHistogram(calculateRgbHistogram(editedWorkCanvas, editedWorkCanvas.width, editedWorkCanvas.height));
          } catch (reason) {
            logWarn("photo-lab-histogram", "Could not sample edited preview", reason);
          }
        } catch (reason: unknown) {
          if (sequence === renderSequence.current) {
            const message = reason instanceof Error ? reason.message : "Could not process this image.";
            setError(message); logError("photo-lab-render", message, reason);
          }
        } finally {
          editedWorkCanvas.width = editedWorkCanvas.height = 1;
          originalWorkCanvas.width = originalWorkCanvas.height = 1;
        }
      })();
    }, quality === "eco" ? 130 : 75);
    return () => {
      window.clearTimeout(timer);
      renderSequence.current += 1;
      // Work canvases are not shared with the UI; any active render can safely finish and release them.
    };
  }, [sourceImage, settings, baseline, adjustments, quality, subjectMask]);

  useEffect(() => {
    if (!sourceImage) {
      setRgbHistogram(null);
      if (canvasRef.current) { canvasRef.current.width = 1; canvasRef.current.height = 1; }
      if (originalCanvasRef.current) { originalCanvasRef.current.width = 1; originalCanvasRef.current.height = 1; }
    }
  }, [sourceImage]);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (subjectMaskUrl) URL.revokeObjectURL(subjectMaskUrl); }, [subjectMaskUrl]);
  useEffect(() => () => {
    fileLoadSequence.current += 1;
    loadSequence.current += 1;
    maskLoadSequence.current += 1;
    renderSequence.current += 1;
  }, []);

  async function loadFile(file?: File) {
    if (!file) return;
    setError(""); setStatus("");
    const validationError = validatePhotoFile(file);
    if (validationError) { setError(validationError); logWarn("photo-lab-import", "Rejected photo file", { type: file.type, name: file.name, bytes: file.size, reason: validationError }); return; }
    const requestSequence = ++fileLoadSequence.current;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (requestSequence !== fileLoadSequence.current) { URL.revokeObjectURL(url); return; }
      const dimensionError = validatePhotoDimensions(image.naturalWidth, image.naturalHeight);
      if (dimensionError) {
        URL.revokeObjectURL(url); setError(dimensionError);
        logWarn("photo-lab-import", "Rejected photo dimensions", { name: file.name, width: image.naturalWidth, height: image.naturalHeight, reason: dimensionError });
        return;
      }
      const photoSequence = ++loadSequence.current;
      maskLoadSequence.current += 1;
      setSourceUrl(url); setSourceImage(image); setSourceFile(file); setFileName(file.name);
      setSubjectMask(null); if (subjectMaskUrl) URL.revokeObjectURL(subjectMaskUrl); setSubjectMaskUrl(null);
      setExif(null); setFingerprint(null);
      void readExif(file)
        .then((metadata) => { if (photoSequence === loadSequence.current) setExif(metadata); })
        .catch((reason) => { if (photoSequence === loadSequence.current) logWarn("photo-lab-exif", "Could not read EXIF metadata", reason); });
      void sha256Fingerprint(file)
        .then((value) => { if (photoSequence === loadSequence.current) setFingerprint(value); })
        .catch((reason) => { if (photoSequence === loadSequence.current) logWarn("photo-lab-fingerprint", "SHA-256 fingerprint unavailable", reason); });
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      setBaseline({ ...settings }); setAdjustments(initialAdjustments);
      setHistory([initialAdjustments]); setHistoryIndex(0); setCompareMode("wipe"); setWipePosition(50); setZoom(100); setPan({ x: 0, y: 0 });
      setStatus("Photo loaded locally. The original remains unchanged and is not uploaded.");
      logInfo("photo-lab-import", "Photo imported for local testing", { name: file.name, bytes: file.size, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      if (requestSequence !== fileLoadSequence.current) return;
      const message = "The image could not be decoded. Try exporting it as JPEG, PNG, or WebP.";
      setError(message); logError("photo-lab-import", message, { name: file.name, type: file.type });
    };
    image.src = url;
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.target.files?.[0]); event.target.value = "";
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); void loadFile(event.dataTransfer.files?.[0]);
  }
  function updateWipeFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    setWipePosition(Math.round(clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100)));
  }
  function beginStagePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".photo-wipe-handle") && compareMode === "wipe") {
      event.preventDefault();
      wipeDragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateWipeFromPointer(event);
      return;
    }
    if (zoom <= 100 || !target.closest(".photo-stage-image") || event.button !== 0) return;
    event.preventDefault();
    panDragging.current = true;
    setIsPanning(true);
    panOrigin.current = { pointerX: event.clientX, pointerY: event.clientY, x: pan.x, y: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveStagePointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (wipeDragging.current) {
      updateWipeFromPointer(event);
      return;
    }
    if (!panDragging.current || !panOrigin.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const origin = panOrigin.current;
    const maxX = Math.max(0, bounds.width * (zoom / 100 - 1) * 0.5 + 12);
    const maxY = Math.max(0, bounds.height * (zoom / 100 - 1) * 0.5 + 12);
    setPan({
      x: clamp(origin.x + event.clientX - origin.pointerX, -maxX, maxX),
      y: clamp(origin.y + event.clientY - origin.pointerY, -maxY, maxY),
    });
  }
  function endStagePointer(event: ReactPointerEvent<HTMLDivElement>) {
    wipeDragging.current = false;
    panDragging.current = false;
    panOrigin.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function changeZoom(next: number) {
    const bounded = clamp(next, 50, 200);
    setZoom(bounded);
    if (bounded <= 100) setPan({ x: 0, y: 0 });
    else if (stageRef.current) {
      const bounds = stageRef.current.getBoundingClientRect();
      setPan((old) => ({
        x: clamp(old.x, -Math.max(0, bounds.width * (bounded / 100 - 1) * 0.5 + 12), Math.max(0, bounds.width * (bounded / 100 - 1) * 0.5 + 12)),
        y: clamp(old.y, -Math.max(0, bounds.height * (bounded / 100 - 1) * 0.5 + 12), Math.max(0, bounds.height * (bounded / 100 - 1) * 0.5 + 12)),
      }));
    }
  }
  function beginAdjustment() {
    if (!gestureStart.current) gestureStart.current = { ...adjustments };
  }
  function finishAdjustment() {
    const start = gestureStart.current;
    if (!start) return;
    gestureStart.current = null;
    const changed = Object.keys(initialAdjustments).some((key) => start[key as AdjustmentKey] !== adjustments[key as AdjustmentKey]);
    if (!changed) return;
    const next = [...history.slice(0, historyIndex + 1), { ...adjustments }].slice(-40);
    setHistory(next);
    setHistoryIndex(next.length - 1);
  }
  function updateAdjustment(key: AdjustmentKey, value: number) {
    setAdjustments((old) => ({ ...old, [key]: value }));
  }
  function commitAdjustment(patch: Partial<PhotoLabAdjustments>) {
    const next = { ...adjustments, ...patch };
    const nextHistory = [...history.slice(0, historyIndex + 1), next].slice(-40);
    setAdjustments(next); setHistory(nextHistory); setHistoryIndex(nextHistory.length - 1);
  }
  function undo() {
    if (historyIndex <= 0) return;
    const next = historyIndex - 1; setHistoryIndex(next); setAdjustments({ ...history[next] });
  }
  function redo() {
    if (historyIndex >= history.length - 1) return;
    const next = historyIndex + 1; setHistoryIndex(next); setAdjustments({ ...history[next] });
  }
  function resetAdjustments() {
    gestureStart.current = null;
    const next = [...history.slice(0, historyIndex + 1), { ...initialAdjustments }].slice(-40);
    setHistory(next); setHistoryIndex(next.length - 1); setAdjustments({ ...initialAdjustments });
  }

  async function exportResult(saveToGallery: boolean) {
    if (!canvasRef.current || !sourceImage || !baseline) return;
    setBusy(true); setError("");
    try {
      const exportCanvas = document.createElement("canvas");
      await renderUploadedPhoto(sourceImage, exportCanvas, { quality, baseline, current: settings, adjustments, fullResolution: true, subjectMask });
      const blob = await new Promise<Blob>((resolve, reject) => exportCanvas.toBlob((value) => value ? resolve(value) : reject(new Error("The browser could not encode the result.")), "image/jpeg", 0.94));
      const expectedExport = getPhotoRenderGeometry(dimensions.width, dimensions.height, adjustments, quality, true);
      const memoryResized = exportCanvas.width < expectedExport.width || exportCanvas.height < expectedExport.height;
      const sizeNote = memoryResized
        ? `resized to ${exportCanvas.width} × ${exportCanvas.height}px to protect browser memory`
        : `${exportCanvas.width} × ${exportCanvas.height}px`;
      exportCanvas.width = 1; exportCanvas.height = 1;
      if (saveToGallery) { await onSaveCapture(blob, fileName); setStatus(`Processed photo saved to Gallery · ${sizeNote}.`); }
      else {
        const url = URL.createObjectURL(blob); const link = document.createElement("a");
        link.href = url; link.download = photoLabDownloadName(fileName); link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus(`Processed JPEG exported · ${sizeNote}.`);
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Export failed.";
      setError(message); logError("photo-lab-export", message, reason);
    } finally { setBusy(false); }
  }

  async function refreshRecipes(selectId?: string) {
    const items = await listPhotoRecipes(); setRecipes(items);
    if (selectId) setSelectedRecipeId(selectId);
  }

  async function getCurrentPhotoFingerprint(): Promise<string | null> {
    const sequence = loadSequence.current;
    const file = sourceFile;
    if (!file) return null;
    const value = fingerprint ?? await sha256Fingerprint(file);
    if (sequence !== loadSequence.current) {
      throw new Error("The photograph changed while its fingerprint was being calculated. Please retry the recipe action.");
    }
    if (value) setFingerprint(value);
    return value;
  }

  function currentRecipeDocument(name: string, id?: string, revision = 1, createdAt?: string, imageFingerprint: string | null = fingerprint) {
    return createPhotoRecipeDocument({
      id, name, description: `Settings for ${fileName}`,
      image: { name: fileName, width: dimensions.width, height: dimensions.height, ...(imageFingerprint ? { fingerprint: imageFingerprint } : {}) },
      mode, cameraSettings: { ...settings }, adjustments: { ...adjustments }, revision, createdAt,
      history: [`Created for ${fileName}`],
    });
  }

  async function createRecipe() {
    if (!sourceImage) return;
    const name = window.prompt("Name this shot recipe:", fileName.replace(/\.[^.]+$/, "") + " recipe");
    if (!name?.trim()) return;
    try {
      const photoSequence = loadSequence.current;
      const imageFingerprint = await getCurrentPhotoFingerprint();
      if (photoSequence !== loadSequence.current) return;
      const document = currentRecipeDocument(name.trim(), undefined, 1, undefined, imageFingerprint);
      const record = createPhotoRecipeRecord(document, "Created from current Photo Lab settings");
      const persistent = await savePhotoRecipe(record);
      if (photoSequence !== loadSequence.current) return;
      await refreshRecipes(record.id);
      setStatus(persistent ? `Recipe '${record.name}' saved with revision 1.` : "Recipe saved for this session only because persistent browser storage is unavailable.");
      logInfo("photo-recipes", "Created photo recipe", { id: record.id, name: record.name });
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Could not create recipe."; setError(message); logError("photo-recipes", message, reason); }
  }

  async function updateRecipe() {
    const record = recipes.find((item) => item.id === selectedRecipeId);
    if (!record || !sourceImage) return;
    try {
      const photoSequence = loadSequence.current;
      const imageFingerprint = await getCurrentPhotoFingerprint();
      if (photoSequence !== loadSequence.current) return;
      const document = currentRecipeDocument(record.name, record.id, record.currentRevision + 1, new Date(record.createdAt).toISOString(), imageFingerprint);
      const next = appendPhotoRecipeRevision(record, document, "Updated from current Photo Lab settings");
      const persistent = await savePhotoRecipe(next);
      if (photoSequence !== loadSequence.current) return;
      await refreshRecipes(next.id);
      setStatus(persistent ? `Saved recipe revision ${next.currentRevision}.` : "Updated for this session only; browser storage is unavailable.");
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Could not update recipe."; setError(message); logError("photo-recipes", message, reason); }
  }

  async function applyRecipe() {
    const record = recipes.find((item) => item.id === selectedRecipeId);
    if (!record || !sourceImage) return;
    try {
      const photoSequence = loadSequence.current;
      const currentFingerprint = await getCurrentPhotoFingerprint();
      if (photoSequence !== loadSequence.current) return;
      const document = parsePhotoRecipe(record.currentText);
      const sameDimensions = document.image.width === dimensions.width && document.image.height === dimensions.height;
      const fingerprintMatches = !document.image.fingerprint || document.image.fingerprint === currentFingerprint;
      const matches = sameDimensions && document.image.name === fileName && fingerprintMatches;
      if (!matches && !window.confirm(document.image.fingerprint && fingerprint ? "The photograph fingerprint or dimensions do not match this recipe. Apply its settings anyway?" : "This recipe was saved for a different image name or size. Apply its settings anyway?")) return;
      const normalizedSettings: CameraSettings = {
        ...document.cameraSettings,
        aperture: apertureValues[nearestIndex(apertureValues, document.cameraSettings.aperture)] ?? settings.aperture,
        shutter: shutterValues[nearestIndex(shutterValues, document.cameraSettings.shutter)] ?? settings.shutter,
        iso: isoValues[nearestIndex(isoValues, document.cameraSettings.iso)] ?? settings.iso,
      };
      const profileAdjusted = normalizedSettings.aperture !== document.cameraSettings.aperture || normalizedSettings.shutter !== document.cameraSettings.shutter || normalizedSettings.iso !== document.cameraSettings.iso;
      onApplyCameraSettings(normalizedSettings, document.mode);
      setBaseline({ ...normalizedSettings }); setAdjustments({ ...document.adjustments });
      setHistory([{ ...document.adjustments }]); setHistoryIndex(0);
      setStatus(`Applied '${document.name}' revision ${document.revision}${profileAdjusted ? " with camera limits normalized to the active profile" : ""}.`);
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Could not apply recipe."; setError(message); logError("photo-recipes", message, reason); }
  }

  async function deleteRecipe() {
    const record = recipes.find((item) => item.id === selectedRecipeId);
    if (!record || !window.confirm(`Permanently delete '${record.name}' and its saved revisions?`)) return;
    const persistent = await deletePhotoRecipe(record.id);
    setSelectedRecipeId(""); await refreshRecipes();
    setStatus(persistent ? `Deleted '${record.name}' and its local revisions.` : `Removed '${record.name}' for this session. Persistent storage could not confirm deletion.`);
  }

  function exportRecipe() {
    const record = recipes.find((item) => item.id === selectedRecipeId);
    if (!record) return;
    try {
      const document = parsePhotoRecipe(record.currentText);
      const safe = record.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "photo-recipe";
      downloadText(`${safe}.lensrecipe.txt`, serializePhotoRecipeRecord(record));
      setStatus(`Exported ${record.name}.lensrecipe.txt with ${record.versions.length} revision snapshots.`);
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Could not export recipe."; setError(message); }
  }

  async function importRecipe(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 1_000_000) { setError("Recipe TXT files must be 1 MB or smaller."); return; }
    try {
      const imported = parsePhotoRecipeFile(await file.text());
      const existing = await listPhotoRecipes();
      const id = existing.some((item) => item.id === imported.document.id)
        ? (globalThis.crypto?.randomUUID?.() ?? `recipe-${Date.now()}-${Math.random().toString(36).slice(2)}`)
        : imported.document.id;
      const importedDocument = { ...imported.document, id };
      const versions = imported.versions.map((version) => {
        const snapshot = parsePhotoRecipe(version.text);
        return { ...version, text: serializePhotoRecipe({ ...snapshot, id }) };
      });
      const now = Date.now();
      const record = {
        id, name: importedDocument.name, description: importedDocument.description,
        createdAt: Date.parse(importedDocument.createdAt) || now,
        updatedAt: Date.parse(importedDocument.updatedAt) || now,
        currentRevision: importedDocument.revision,
        currentText: serializePhotoRecipe(importedDocument),
        versions,
      };
      const persistent = await savePhotoRecipe(record);
      await refreshRecipes(record.id);
      setStatus(persistent
        ? `Imported '${record.name}' with ${versions.length} revision snapshots.`
        : `Imported '${record.name}' for this session only because persistent browser storage is unavailable.`);
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Recipe import failed."; setError(message); logWarn("photo-recipes", message, { name: file.name }); }
  }

  async function restoreRevision(revision: number) {
    const record = recipes.find((item) => item.id === selectedRecipeId);
    if (!record) return;
    try {
      const next = restorePhotoRecipeRevision(record, revision);
      const persistent = await savePhotoRecipe(next); await refreshRecipes(next.id);
      setStatus(persistent
        ? `Restored revision ${revision} as new revision ${next.currentRevision}.`
        : `Restored revision ${revision} for this session as revision ${next.currentRevision}; persistent storage is unavailable.`);
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Could not restore revision."; setError(message); }
  }

  async function loadSubjectMask(file?: File) {
    if (!file) return;
    const validation = validatePhotoFile(file);
    if (validation) { setError(`Subject mask: ${validation}`); return; }
    const maskSequence = ++maskLoadSequence.current;
    const photoSequence = loadSequence.current;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (maskSequence !== maskLoadSequence.current || photoSequence !== loadSequence.current) {
        URL.revokeObjectURL(url);
        return;
      }
      const dimensionsError = validatePhotoDimensions(image.naturalWidth, image.naturalHeight);
      if (dimensionsError) { URL.revokeObjectURL(url); setError(`Subject mask: ${dimensionsError}`); return; }
      if (!sourceImage || Math.abs(image.naturalWidth / image.naturalHeight - sourceImage.naturalWidth / sourceImage.naturalHeight) > .015) {
        URL.revokeObjectURL(url); setError("The subject mask must have the same aspect ratio as the photograph."); return;
      }
      if (subjectMaskUrl) URL.revokeObjectURL(subjectMaskUrl);
      setSubjectMaskUrl(url);
      setSubjectMask(image);
      setStatus("Subject mask loaded. White areas stay sharp; dark areas receive background blur.");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      if (maskSequence === maskLoadSequence.current && photoSequence === loadSequence.current) setError("Could not decode the mask image.");
    };
    image.src = url;
  }

  async function batchExport(files: FileList | null) {
    if (!files?.length || batchBusy) return;
    const batchBaseline = baseline ?? { ...settings };
    const chosen = [...files];
    if (chosen.length > 20) { setError("Batch processing accepts up to 20 photographs at a time. Select 20 or fewer."); return; }
    setBatchBusy(true); setError(""); setStatus(`Preparing batch of ${chosen.length} photographs…`);
    try {
      const entries: Array<{name:string;data:Uint8Array}> = []; let totalBytes = 0;
      for (let i=0;i<chosen.length;i++) {
        const file=chosen[i]; const validation=validatePhotoFile(file); if(validation) throw new Error(`${file.name}: ${validation}`);
        const url=URL.createObjectURL(file);
        try {
          const image=new Image(); image.decoding="async";
          await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error(`Could not decode ${file.name}.`));image.src=url;});
          const dimensionsError=validatePhotoDimensions(image.naturalWidth,image.naturalHeight); if(dimensionsError) throw new Error(`${file.name}: ${dimensionsError}`);
          const output=document.createElement("canvas");
          await renderUploadedPhoto(image,output,{quality,baseline:batchBaseline,current:settings,adjustments,subjectMask:null,fullResolution:true});
          const blob=await new Promise<Blob>((resolve,reject)=>output.toBlob(value=>value?resolve(value):reject(new Error(`Could not encode ${file.name}.`)),"image/jpeg",.92));
          totalBytes += blob.size; if (totalBytes > 150 * 1024 * 1024) throw new Error("Batch output exceeded the 150 MB safety limit. Process fewer or smaller photographs.");
          entries.push({name:`${String(i+1).padStart(2,"0")}-${file.name.replace(/\.[^.]+$/,"")}-lens-lab.jpg`,data:new Uint8Array(await blob.arrayBuffer())});
          output.width=output.height=1;
          setStatus(`Processed ${i+1} of ${chosen.length}: ${file.name}`);
        } finally { URL.revokeObjectURL(url); }
      }
      const batchManifest = ["LENS LAB BATCH EXPORT", "=====================", `Created: ${new Date().toISOString()}`, `Files: ${entries.length}`, `Mode: ${mode}`, `Aperture: f/${settings.aperture}`, `Shutter: ${settings.shutter}s`, `ISO: ${settings.iso}`, `Exposure: ${adjustments.exposure} EV`, `Contrast: ${adjustments.contrast}`, `Saturation: ${adjustments.saturation}`, `Warmth: ${adjustments.warmth}`, `Vibrance: ${adjustments.vibrance}`, `Tint: ${adjustments.tint}`, `Sharpen: ${adjustments.sharpen}`, `Rotation: ${adjustments.rotation}`, `Crop: ${adjustments.cropLeft},${adjustments.cropTop},${adjustments.cropRight},${adjustments.cropBottom}`, "Depth mask: not applied to batch; masks are specific to the currently open photograph.", "", "All outputs are processed JPEG exports. Source files were not modified."].join("\n");
      entries.push({ name: "LENS-LAB-BATCH-INFO.txt", data: new TextEncoder().encode(batchManifest) });
      const archive=createZipStore(entries); const url=URL.createObjectURL(archive); const link=document.createElement("a");link.href=url;link.download=`lens-lab-batch-${new Date().toISOString().replace(/[:.]/g,"-")}.zip`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);
      setStatus(`Batch complete. ${chosen.length} processed photographs exported in one ZIP archive.${subjectMask ? " The current photograph's depth mask was intentionally excluded from batch processing." : ""}`);
      logInfo("photo-lab-batch","Batch export completed",{count:chosen.length,depthMaskApplied:false});
    } catch(reason) { const message=reason instanceof Error?reason.message:"Batch processing failed.";setError(message);logError("photo-lab-batch",message,reason); }
    finally { setBatchBusy(false); }
  }

  const selectedRecipe = recipes.find((item) => item.id === selectedRecipeId) ?? null;
  const showOriginal = compareMode !== "edited";
  const selectedVersion = selectedRecipe?.versions.find((item) => item.revision === selectedRecipe.currentRevision);

  return (
    <section className="content-page photo-lab-page photo-lab-compact">
      <div className="photo-compact-header">
        <div className="photo-compact-title"><div className="photo-lab-mark"><Aperture size={17}/></div><div><div className="section-kicker">LOCAL IMAGE EXPERIMENTATION</div><h1>Photo Lab <span>/ YOUR PHOTOGRAPHS</span></h1></div></div>
        <div className="photo-header-actions">
          <span className="photo-local-chip"><span className="online-dot"/> ON DEVICE</span>
          {sourceImage && <>
            <button className="compact-icon-button" title="Undo adjustment" aria-label="Undo adjustment" onClick={undo} disabled={historyIndex <= 0}><Undo2 size={15}/></button>
            <button className="compact-icon-button" title="Redo adjustment" aria-label="Redo adjustment" onClick={redo} disabled={historyIndex >= history.length - 1}><Redo2 size={15}/></button>
            <button className="compact-icon-button" title="Toggle adjustment panel" aria-label="Toggle adjustment panel" onClick={() => setInspectorOpen((value) => !value)}><SlidersHorizontal size={15}/></button>
          </>}
        </div>
      </div>

      {!sourceImage ? (
        <div className={`photo-upload-zone photo-upload-compact ${dragging ? "drag-active" : ""}`} data-guide="photo-upload"
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <div className="photo-upload-icon"><ImagePlus size={26}/></div>
          <h2>Bring your own photograph.</h2>
          <p>Drop an image here or browse your device. Your original remains untouched.</p>
          <button className="primary-button" onClick={() => inputRef.current?.click()}><Upload size={15}/> CHOOSE PHOTO</button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onInputChange} hidden /><button className="subtle-button" disabled={batchBusy} onClick={() => batchInputRef.current?.click()}><FileArchive size={14}/> BATCH PROCESS</button><input ref={batchInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event)=>{void batchExport(event.target.files);event.target.value="";}}/>
          <div className="photo-upload-meta">JPEG · PNG · WEBP <i/> UP TO 30 MB <i/> 50 MP <i/> LOCAL ONLY</div><small className="photo-control-hint">Batch applies the current camera and adjustment settings to up to 20 photographs, then exports one ZIP.</small>
        </div>
      ) : (
        <div className={`photo-editor-shell ${inspectorOpen ? "inspector-open" : "inspector-closed"}`}>
          <div className="photo-editor-toolbar">
            <div className="photo-file-info"><FileImage size={16}/><div><b title={fileName}>{fileName}</b><small>{dimensions.width.toLocaleString()} × {dimensions.height.toLocaleString()}px · {(dimensions.width * dimensions.height / 1_000_000).toFixed(1)} MP</small></div></div>
            <div className="photo-toolbar-center">
              <div className="photo-view-toggle" aria-label="Image comparison mode">
                <button className={compareMode === "wipe" ? "active" : ""} onClick={() => setCompareMode("wipe")} title="Drag the divider to compare"><ArrowLeftRight size={13}/> WIPE</button>
                <button className={compareMode === "original" ? "active" : ""} onClick={() => setCompareMode("original")}>ORIGINAL</button>
                <button className={compareMode === "edited" ? "active" : ""} onClick={() => setCompareMode("edited")}>EDITED</button>
              </div>
            </div>
            <div className="photo-toolbar-actions">
              <button className="compact-icon-button" onClick={() => changeZoom(zoom - 10)} title="Zoom out"><Minus size={14}/></button>
              <button className="photo-zoom-value" onClick={() => changeZoom(100)} title="Reset zoom / fit">{zoom}%</button>
              <button className="compact-icon-button" onClick={() => changeZoom(zoom + 10)} title="Zoom in"><Plus size={14}/></button>
              <button className="subtle-button photo-replace-button" onClick={() => inputRef.current?.click()}><ImagePlus size={13}/> REPLACE</button><button className="subtle-button photo-replace-button" disabled={batchBusy} onClick={()=>batchInputRef.current?.click()}><FileArchive size={13}/> BATCH</button>
              <button className="compact-icon-button" onClick={() => { fileLoadSequence.current += 1; loadSequence.current += 1; maskLoadSequence.current += 1; renderSequence.current += 1; setSourceImage(null); setSourceUrl(null); setSourceFile(null); setFileName(""); setBaseline(null); setSubjectMask(null); setSubjectMaskUrl(null); setFingerprint(null); setExif(null); setRgbHistogram(null); setDimensions({ width: 0, height: 0 }); setStatus(""); setError(""); }} title="Close photograph"><X size={15}/></button>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onInputChange} hidden /><input ref={batchInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event)=>{void batchExport(event.target.files);event.target.value="";}}/>
            </div>
          </div>

          <div className="photo-editor-body">
            <div className="photo-stage-column">
              <div ref={stageRef} className={`photo-image-stage ${dragging ? "drag-active" : ""} ${zoom > 100 ? "is-zoomed" : ""} ${isPanning ? "is-panning" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
                onPointerDown={beginStagePointer} onPointerMove={moveStagePointer} onPointerUp={endStagePointer} onPointerCancel={endStagePointer}>
                {sourceUrl && <canvas ref={originalCanvasRef} className={`photo-stage-image photo-original-image ${showOriginal ? "" : "photo-render-hidden"}`} aria-label="Original photograph with matching crop and rotation" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})` }}/ >}
                <canvas ref={canvasRef} className={`photo-stage-image photo-edited-canvas ${compareMode === "wipe" ? "photo-wipe-overlay" : ""} ${compareMode === "original" ? "photo-render-hidden" : ""}`} aria-label="Edited photograph preview"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`, clipPath: compareMode === "wipe" ? `inset(0 0 0 ${wipePosition}%)` : undefined }}/ >
                {compareMode === "wipe" && <div className="photo-wipe-handle" style={{ left: `${wipePosition}%` }} aria-hidden="true"><span><ChevronLeft size={12}/><ChevronRight size={12}/></span></div>}
                <div className="photo-stage-labels"><span>{compareMode === "edited" ? "SIMULATED RESULT" : "ORIGINAL"}</span><span>{compareMode === "wipe" ? "DRAG DIVIDER" : compareMode.toUpperCase()}</span></div>
                {busy && <div className="photo-stage-busy">Preparing export…</div>}
              </div>
              {compareMode === "wipe" && <div className="photo-wipe-control"><span>BEFORE</span><input aria-label="Before and after comparison divider" type="range" min="0" max="100" value={wipePosition} onChange={(event) => setWipePosition(Number(event.target.value))}/><span>AFTER</span></div>}
              <div className="photo-stage-footer"><span>{zoom === 100 ? "FIT PREVIEW" : `${zoom}% ZOOM · DRAG TO PAN`} · {quality.toUpperCase()} PREVIEW</span><span>ORIGINAL PRESERVED <i/> LOCAL PROCESSING</span></div>
            </div>

            {inspectorOpen && <aside className="photo-inspector" aria-label="Photo editing controls" data-guide="photo-inspector">
              <div className="photo-inspector-heading"><div><div className="section-kicker">LIVE ADJUSTMENTS</div><h2>Image controls</h2></div><button className="compact-icon-button" onClick={() => setInspectorOpen(false)} aria-label="Hide editing panel" title="Hide editing panel"><ChevronRight size={16}/></button></div>
              <div className="photo-inspector-group"><div className="photo-group-title"><Aperture size={13}/> CAMERA RESPONSE</div>
                <label className="photo-control compact-control"><span>Aperture <b>f/{settings.aperture.toFixed(1)}</b></span><input type="range" min="0" max={Math.max(0, apertureValues.length - 1)} step="1" value={nearestIndex(apertureValues, settings.aperture)} disabled={mode === "Tv" || mode === "P"} onChange={(event) => onCameraSetting("aperture", apertureValues[Number(event.target.value)])}/></label>
                <label className="photo-control compact-control"><span>Shutter <b>{shutterLabel(settings.shutter)}</b></span><input type="range" min="0" max={Math.max(0, shutterValues.length - 1)} step="1" value={nearestIndex(shutterValues, settings.shutter)} disabled={mode === "Av" || mode === "P"} onChange={(event) => onCameraSetting("shutter", shutterValues[Number(event.target.value)])}/></label>
                <label className="photo-control compact-control"><span>ISO <b>{settings.iso}</b></span><input type="range" min="0" max={Math.max(0, isoValues.length - 1)} step="1" value={nearestIndex(isoValues, settings.iso)} onChange={(event) => onCameraSetting("iso", isoValues[Number(event.target.value)])}/></label>
                <p className="photo-control-hint">Settings alter brightness relative to the baseline captured on import. They do not reconstruct missing EXIF data.</p>
              </div>
              <div className="photo-inspector-group"><div className="photo-group-title"><Sparkles size={13}/> IMAGE ADJUSTMENTS</div>
                <label className="photo-control compact-control"><span>Exposure <b>{adjustments.exposure > 0 ? "+" : ""}{adjustments.exposure.toFixed(1)} EV</b></span><input type="range" min="-4" max="4" step="0.1" value={adjustments.exposure} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onPointerCancel={finishAdjustment} onBlur={finishAdjustment} onKeyDown={beginAdjustment} onKeyUp={finishAdjustment} onChange={(event) => updateAdjustment("exposure", Number(event.target.value))}/></label>
                <label className="photo-control compact-control"><span>Contrast <b>{adjustments.contrast.toFixed(2)}×</b></span><input type="range" min="0.6" max="1.6" step="0.05" value={adjustments.contrast} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onPointerCancel={finishAdjustment} onBlur={finishAdjustment} onKeyDown={beginAdjustment} onKeyUp={finishAdjustment} onChange={(event) => updateAdjustment("contrast", Number(event.target.value))}/></label>
                <label className="photo-control compact-control"><span>Saturation <b>{adjustments.saturation.toFixed(2)}×</b></span><input type="range" min="0" max="1.8" step="0.05" value={adjustments.saturation} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onPointerCancel={finishAdjustment} onBlur={finishAdjustment} onKeyDown={beginAdjustment} onKeyUp={finishAdjustment} onChange={(event) => updateAdjustment("saturation", Number(event.target.value))}/></label>
                <label className="photo-control compact-control"><span>Softness <b>{adjustments.focusSoftness.toFixed(1)}px</b></span><input type="range" min="0" max="8" step="0.25" value={adjustments.focusSoftness} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onPointerCancel={finishAdjustment} onBlur={finishAdjustment} onKeyDown={beginAdjustment} onKeyUp={finishAdjustment} onChange={(event) => updateAdjustment("focusSoftness", Number(event.target.value))}/></label>
                <label className="photo-control compact-control"><span>Warmth <b>{adjustments.warmth > 0 ? "+" : ""}{Math.round(adjustments.warmth)}</b></span><input type="range" min="-100" max="100" step="5" value={adjustments.warmth} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onPointerCancel={finishAdjustment} onBlur={finishAdjustment} onKeyDown={beginAdjustment} onKeyUp={finishAdjustment} onChange={(event) => updateAdjustment("warmth", Number(event.target.value))}/></label>
                <button className="text-action photo-reset-action" onClick={resetAdjustments}><RotateCcw size={12}/> RESET ADJUSTMENTS</button>
              </div>
              <div className="photo-inspector-group"><div className="photo-group-title"><Crop size={13}/> GEOMETRY & COLOR</div>
                <div className="photo-recipe-actions"><button className="subtle-button" onClick={()=>commitAdjustment({rotation:(adjustments.rotation+90)%360})}><RotateCw size={12}/> ROTATE 90°</button><button className="subtle-button" onClick={()=>commitAdjustment({cropLeft:0,cropTop:0,cropRight:0,cropBottom:0})}>RESET CROP</button></div>
                {(["cropLeft","cropTop","cropRight","cropBottom"] as const).map(key=><label className="photo-control compact-control" key={key}><span>{({cropLeft:"Crop left",cropTop:"Crop top",cropRight:"Crop right",cropBottom:"Crop bottom"})[key]} <b>{Math.round(adjustments[key]*100)}%</b></span><input type="range" min="0" max="0.45" step="0.01" value={adjustments[key]} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onBlur={finishAdjustment} onChange={e=>updateAdjustment(key,Number(e.target.value))}/></label>)}
                <label className="photo-control compact-control"><span>Vibrance <b>{adjustments.vibrance.toFixed(2)}</b></span><input type="range" min="-1" max="1" step="0.05" value={adjustments.vibrance} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onBlur={finishAdjustment} onChange={e=>updateAdjustment("vibrance",Number(e.target.value))}/></label>
                <label className="photo-control compact-control"><span>Tint <b>{adjustments.tint}</b></span><input type="range" min="-100" max="100" step="5" value={adjustments.tint} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onBlur={finishAdjustment} onChange={e=>updateAdjustment("tint",Number(e.target.value))}/></label>
                <label className="photo-control compact-control"><span>Sharpen <b>{adjustments.sharpen.toFixed(2)}</b></span><input type="range" min="0" max="1" step="0.05" value={adjustments.sharpen} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onBlur={finishAdjustment} onChange={e=>updateAdjustment("sharpen",Number(e.target.value))}/></label>
              </div>
              <div className="photo-inspector-group"><div className="photo-group-title"><Layers size={13}/> DEPTH MASK</div>
                <p className="photo-control-hint">Import a grayscale mask with the same aspect ratio as this photograph; its pixel resolution may differ. White keeps the subject sharp; black blurs the background. This is not automatic AI segmentation.</p>
                <div className="photo-recipe-actions"><button className="subtle-button" onClick={()=>maskInputRef.current?.click()}><Upload size={12}/> LOAD MASK</button><button className="subtle-button" disabled={!subjectMask} onClick={()=>{maskLoadSequence.current += 1;if(subjectMaskUrl)URL.revokeObjectURL(subjectMaskUrl);setSubjectMask(null);setSubjectMaskUrl(null);commitAdjustment({depthBlur:0});}}>CLEAR</button><input ref={maskInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{void loadSubjectMask(e.target.files?.[0]);e.target.value="";}}/></div>
                <label className="photo-control compact-control"><span>Background blur <b>{adjustments.depthBlur.toFixed(1)}px</b></span><input type="range" min="0" max="24" step="0.5" value={adjustments.depthBlur} disabled={!subjectMask} onPointerDown={beginAdjustment} onPointerUp={finishAdjustment} onBlur={finishAdjustment} onChange={e=>updateAdjustment("depthBlur",Number(e.target.value))}/></label>
              </div>
              <div className="photo-inspector-group"><div className="photo-group-title"><Fingerprint size={13}/> IMAGE ANALYSIS</div>
                <div className="photo-metadata-grid"><span>Make / camera</span><b>{[exif?.cameraMake,exif?.cameraModel].filter(Boolean).join(" ") || "Not recorded"}</b><span>Lens</span><b>{exif?.lensModel || "Not recorded"}</b><span>Aperture</span><b>{exif?.aperture ? `f/${exif.aperture}` : "—"}</b><span>Shutter</span><b>{exif?.shutterSeconds ? (exif.shutterSeconds >= 1 ? `${exif.shutterSeconds}s` : `1/${Math.round(1/exif.shutterSeconds)}s`) : "—"}</b><span>ISO</span><b>{exif?.iso ?? "—"}</b><span>Focal length</span><b>{exif?.focalLengthMm ? `${exif.focalLengthMm}mm` : "—"}</b><span>Captured</span><b>{exif?.dateTimeOriginal || "—"}</b><span>Orientation</span><b>{exif?.orientation ?? "—"}</b><span>GPS tags</span><b>{exif?.gpsPresent ? "Present · private" : "Not found"}</b></div>
                <div className="photo-histogram"><div className="photo-group-title">RGB + LUMA HISTOGRAM · EDITED PREVIEW</div>{rgbHistogram && <svg viewBox="0 0 256 72" role="img" aria-label="Red, green, blue, and luminance histograms of the edited preview"><polyline fill="none" stroke="#ef6464" strokeWidth="1.5" points={rgbHistogram.red.map((v,i)=>`${i*4},${70-v/Math.max(1,...rgbHistogram.red)*64}`).join(" ")}/><polyline fill="none" stroke="#65c98b" strokeWidth="1.5" points={rgbHistogram.green.map((v,i)=>`${i*4},${70-v/Math.max(1,...rgbHistogram.green)*64}`).join(" ")}/><polyline fill="none" stroke="#67a9ee" strokeWidth="1.5" points={rgbHistogram.blue.map((v,i)=>`${i*4},${70-v/Math.max(1,...rgbHistogram.blue)*64}`).join(" ")}/><polyline fill="none" stroke="#d9d9d9" strokeWidth="1.2" strokeDasharray="3 2" points={rgbHistogram.luminance.map((v,i)=>`${i*4},${70-v/Math.max(1,...rgbHistogram.luminance)*64}`).join(" ")}/></svg>}</div>
                <small className="photo-fingerprint">SHA-256: {fingerprint ? `${fingerprint.slice(0,20)}…` : "Unavailable / calculating"}</small>
              </div>
              <div className="photo-inspector-group"><div className="photo-group-title"><FileText size={13}/> SHOT RECIPE</div>
                <select className="photo-recipe-select" aria-label="Select saved shot recipe" value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>
                  <option value="">Choose a saved recipe…</option>
                  {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name} · r{recipe.currentRevision}</option>)}
                </select>
                <div className="photo-recipe-actions"><button className="primary-button" onClick={() => void createRecipe()}><Save size={13}/> SAVE NEW</button><button className="subtle-button" onClick={() => void updateRecipe()} disabled={!selectedRecipe}><Check size={13}/> NEW REVISION</button></div>
                <div className="photo-recipe-actions"><button className="subtle-button" onClick={() => void applyRecipe()} disabled={!selectedRecipe}>APPLY</button><button className="subtle-button" onClick={exportRecipe} disabled={!selectedRecipe}><ArrowDownToLine size={13}/> TXT</button><button className="compact-icon-button danger-icon" onClick={() => void deleteRecipe()} disabled={!selectedRecipe} title="Delete recipe"><Trash2 size={13}/></button></div>
                <div className="photo-recipe-actions"><button className="text-action" onClick={() => recipeInputRef.current?.click()}><Upload size={12}/> IMPORT TXT RECIPE</button><input ref={recipeInputRef} type="file" accept=".txt,.lensrecipe.txt,text/plain" hidden onChange={(event) => void importRecipe(event)}/></div>
                {selectedRecipe && <div className="photo-recipe-history"><span>HISTORY · {selectedRecipe.versions.length} REVISIONS</span>{selectedRecipe.versions.slice(-3).reverse().map((version) => <div key={version.revision}><span>r{version.revision} · {version.summary}</span><button onClick={() => void restoreRevision(version.revision)} disabled={version.revision === selectedRecipe.currentRevision}>RESTORE</button></div>)}{selectedVersion && <small>Last saved {new Date(selectedVersion.savedAt).toLocaleString()}</small>}</div>}
              </div>
              <div className="photo-inspector-bottom"><button className="primary-button" disabled={busy} onClick={() => void exportResult(false)}><ArrowDownToLine size={14}/> EXPORT JPEG</button><button className="subtle-button" disabled={busy} onClick={() => void exportResult(true)}><Save size={13}/> SAVE TO GALLERY</button><button className="text-action" onClick={onSavePreset}>SAVE CAMERA PRESET <ChevronRight size={12}/></button></div>
            </aside>}
            {!inspectorOpen && <button className="photo-inspector-reopen" onClick={() => setInspectorOpen(true)} title="Show editing controls" aria-label="Show editing controls"><ChevronLeft size={15}/><SlidersHorizontal size={14}/></button>}
          </div>
          <div className="photo-editor-status"><span>{status || "Ready · Original image is preserved"}</span><span>{mode} MODE · {settings.iso} ISO · f/{settings.aperture.toFixed(1)} · {shutterLabel(settings.shutter)}</span></div>
        </div>
      )}
      {error && <div className="alert alert-error photo-compact-alert">{error}</div>}
      {status && !sourceImage && <div className="alert alert-success photo-compact-alert">{status}</div>}
      <div className="photo-lab-disclaimer photo-compact-disclaimer"><Sparkles size={13}/> Local, non-destructive experimentation. Focus softness and motion are global illustrative effects unless depth or motion data exists. Exports are processed JPEGs, not RAW.</div>
    </section>
  );
}
