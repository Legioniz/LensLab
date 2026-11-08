import type { CameraSettings, QualityMode } from "../types/camera";
import { calculateEv100 } from "./exposure";
import { renderBitmapInWorker } from "./workerRenderer";
import { cropRectFromFractions } from "./photoAnalysis";


export const MAX_PHOTO_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_PHOTO_PIXELS = 50_000_000;

export function validatePhotoFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const supported = ["image/jpeg", "image/png", "image/webp"];
  const extensionType = ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as Record<string, string>)[extension ?? ""];
  const inferredType = supported.includes(file.type) ? file.type : extensionType;
  if (!inferredType || !supported.includes(inferredType)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size > MAX_PHOTO_FILE_BYTES) return "The image is larger than 30 MB. Resize it and try again to protect browser memory.";
  if (file.size <= 0) return "The selected image file is empty.";
  return null;
}

export function validatePhotoDimensions(width: number, height: number): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return "The image has invalid dimensions.";
  if (width * height > MAX_PHOTO_PIXELS) return "This image exceeds 50 megapixels. Use a smaller export to avoid exhausting browser memory.";
  return null;
}

export interface PhotoLabAdjustments {
  exposure: number;
  contrast: number;
  saturation: number;
  focusSoftness: number;
  warmth: number;
  vibrance: number;
  tint: number;
  sharpen: number;
  rotation: number;
  cropLeft: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  depthBlur: number;
}

export interface PhotoLabRenderOptions {
  quality: QualityMode;
  baseline: CameraSettings;
  current: CameraSettings;
  adjustments: PhotoLabAdjustments;
  fullResolution?: boolean;
  subjectMask?: HTMLImageElement | null;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const noiseCache = new Map<number, HTMLCanvasElement>();

export interface PhotoRenderGeometry {
  cropX: number;
  cropY: number;
  sourceCropWidth: number;
  sourceCropHeight: number;
  rotation: number;
  scale: number;
  width: number;
  height: number;
}

/** Resolve one canonical geometry for both the edited preview and its before/after layer. */
export function getPhotoRenderGeometry(
  sourceWidth: number,
  sourceHeight: number,
  adjustments: PhotoLabAdjustments,
  quality: QualityMode,
  fullResolution = false,
): PhotoRenderGeometry {
  const crop = cropRectFromFractions(sourceWidth, sourceHeight, adjustments.cropLeft, adjustments.cropTop, adjustments.cropRight, adjustments.cropBottom);
  const rotation = ((Math.round(adjustments.rotation / 90) * 90) % 360 + 360) % 360;
  const swapped = rotation === 90 || rotation === 270;
  const baseWidth = swapped ? crop.height : crop.width;
  const baseHeight = swapped ? crop.width : crop.height;
  const previewMaxEdge = quality === "eco" ? 1000 : quality === "high" ? 2200 : 1600;
  const maxEdge = fullResolution ? Math.max(baseWidth, baseHeight) : previewMaxEdge;
  const pixelBudgetScale = fullResolution ? Math.sqrt(24_000_000 / Math.max(1, baseWidth * baseHeight)) : 1;
  const scale = Math.min(1, maxEdge / Math.max(baseWidth, baseHeight), pixelBudgetScale);
  return {
    cropX: crop.x,
    cropY: crop.y,
    sourceCropWidth: crop.width,
    sourceCropHeight: crop.height,
    rotation,
    scale,
    width: Math.max(1, Math.round(baseWidth * scale)),
    height: Math.max(1, Math.round(baseHeight * scale)),
  };
}

/** Map the photograph crop rectangle into mask-image pixel coordinates.
 * The mask may use a different resolution; normalized coordinates keep its crop aligned.
 */
export function mapPhotoCropToMask(
  photoWidth: number,
  photoHeight: number,
  maskWidth: number,
  maskHeight: number,
  crop: Pick<PhotoRenderGeometry, "cropX" | "cropY" | "sourceCropWidth" | "sourceCropHeight">,
) {
  if ([photoWidth, photoHeight, maskWidth, maskHeight].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Photograph and subject-mask dimensions must be positive numbers.");
  }
  const scaleX = maskWidth / photoWidth;
  const scaleY = maskHeight / photoHeight;
  return {
    x: crop.cropX * scaleX,
    y: crop.cropY * scaleY,
    width: crop.sourceCropWidth * scaleX,
    height: crop.sourceCropHeight * scaleY,
  };
}

/** Render only crop and rotation. Used for an aligned original layer in before/after comparison. */
export function renderOriginalPhoto(
  source: HTMLImageElement,
  canvas: HTMLCanvasElement,
  options: Pick<PhotoLabRenderOptions, "quality" | "adjustments">,
): void {
  if (!source.complete || source.naturalWidth === 0 || source.naturalHeight === 0) {
    throw new Error("The selected image has not finished loading.");
  }
  const geometry = getPhotoRenderGeometry(source.naturalWidth, source.naturalHeight, options.adjustments, options.quality);
  canvas.width = geometry.width;
  canvas.height = geometry.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas comparison rendering is unavailable.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, geometry.width, geometry.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = options.quality === "high" ? "high" : "medium";
  context.save();
  context.translate(geometry.width / 2, geometry.height / 2);
  context.rotate(geometry.rotation * Math.PI / 180);
  context.drawImage(
    source,
    geometry.cropX,
    geometry.cropY,
    geometry.sourceCropWidth,
    geometry.sourceCropHeight,
    -geometry.sourceCropWidth * geometry.scale / 2,
    -geometry.sourceCropHeight * geometry.scale / 2,
    geometry.sourceCropWidth * geometry.scale,
    geometry.sourceCropHeight * geometry.scale,
  );
  context.restore();
}

/** Exposure is relative to the camera settings active when the photo was imported.
 * It is not inferred from EXIF; ordinary files may not contain complete exposure metadata.
 */
export function relativeExposureMultiplier(baseline: CameraSettings, current: CameraSettings): number {
  const deltaEv = calculateEv100(baseline) - calculateEv100(current);
  return 2 ** clamp(deltaEv, -4, 4);
}

export function adjustedExposureMultiplier(baseline: CameraSettings, current: CameraSettings, adjustmentEv = 0): number {
  return relativeExposureMultiplier(baseline, current) * 2 ** clamp(adjustmentEv, -4, 4);
}

function buildNoiseTexture(iso: number): HTMLCanvasElement {
  const key = Math.round(iso);
  const cached = noiseCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 192; canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const pixels = context.createImageData(canvas.width, canvas.height);
  let seed = Math.max(1, Math.round(iso)) * 9301 + 49297;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const value = (seed / 2147483647) * 255;
    pixels.data[i] = value;
    pixels.data[i + 1] = value;
    pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  if (noiseCache.size >= 8) noiseCache.delete(noiseCache.keys().next().value as number);
  noiseCache.set(key, canvas);
  return canvas;
}

export async function renderUploadedPhoto(
  source: HTMLImageElement,
  canvas: HTMLCanvasElement,
  options: PhotoLabRenderOptions,
): Promise<void> {
  if (!source.complete || source.naturalWidth === 0) throw new Error("The selected image has not finished loading.");
  const a = options.adjustments;
  const geometry = getPhotoRenderGeometry(source.naturalWidth, source.naturalHeight, a, options.quality, options.fullResolution ?? false);
  const { cropX, cropY, sourceCropWidth: sourceCropW, sourceCropHeight: sourceCropH, rotation, scale, width, height } = geometry;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas processing is unavailable. Try another modern browser.");
  const exposure = adjustedExposureMultiplier(options.baseline, options.current, a.exposure);
  const contrast = clamp(a.contrast, .6, 1.6);
  const saturation = clamp(a.saturation, 0, 1.8);
  const vibrance = clamp(a.vibrance, -1, 1);
  const blur = clamp(a.focusSoftness, 0, 8) * (options.quality === "eco" ? .72 : 1);
  const filter = `brightness(${exposure.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${(saturation * (1 + vibrance * .35)).toFixed(3)}) blur(${blur.toFixed(2)}px)`;
  context.fillStyle = "#fff"; context.fillRect(0, 0, width, height);

  // Worker/OffscreenCanvas path is used for ordinary previews; every unsupported or failed case falls back below.
  let workerRendered = false;
  if (!options.fullResolution && !options.subjectMask && rotation === 0 && cropX === 0 && cropY === 0 && sourceCropW === source.naturalWidth && sourceCropH === source.naturalHeight && typeof OffscreenCanvas !== "undefined") {
    try {
      const bitmap = await renderBitmapInWorker(source, width, height, filter, rotation);
      try {
        context.drawImage(bitmap, 0, 0, width, height);
        workerRendered = true;
      } finally {
        bitmap.close();
      }
    } catch { /* graceful main-thread fallback */ }
  }
  if (!workerRendered) {
    const temp = document.createElement("canvas"); temp.width = width; temp.height = height;
    const tempCtx = temp.getContext("2d");
    if (!tempCtx) throw new Error("Canvas fallback could not create a drawing context.");
    tempCtx.save(); tempCtx.translate(width / 2, height / 2); tempCtx.rotate(rotation * Math.PI / 180);
    tempCtx.filter = filter;
    tempCtx.drawImage(source, source.naturalWidth * cropX, source.naturalHeight * cropY, sourceCropW, sourceCropH, -sourceCropW * scale / 2, -sourceCropH * scale / 2, sourceCropW * scale, sourceCropH * scale);
    tempCtx.restore();
    context.drawImage(temp, 0, 0);
    temp.width = 1; temp.height = 1;
  }

  // Optional user-supplied subject mask: white pixels retain the sharp subject, black pixels receive background blur.
  if (options.subjectMask && a.depthBlur > 0) {
    const maskCanvas = document.createElement("canvas"); maskCanvas.width = width; maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d");
    const background = document.createElement("canvas"); background.width = width; background.height = height;
    const bgCtx = background.getContext("2d");
    if (maskCtx && bgCtx) {
      const maskCrop = mapPhotoCropToMask(
        source.naturalWidth,
        source.naturalHeight,
        options.subjectMask.naturalWidth,
        options.subjectMask.naturalHeight,
        geometry,
      );
      maskCtx.save(); maskCtx.translate(width / 2, height / 2); maskCtx.rotate(rotation * Math.PI / 180);
      maskCtx.drawImage(options.subjectMask, maskCrop.x, maskCrop.y, maskCrop.width, maskCrop.height, -sourceCropW * scale / 2, -sourceCropH * scale / 2, sourceCropW * scale, sourceCropH * scale); maskCtx.restore();
      const maskPixels = maskCtx.getImageData(0, 0, width, height);
      for (let i = 0; i < maskPixels.data.length; i += 4) { const alpha = Math.round((maskPixels.data[i] * .2126 + maskPixels.data[i + 1] * .7152 + maskPixels.data[i + 2] * .0722) * (maskPixels.data[i + 3] / 255)); maskPixels.data[i] = 255; maskPixels.data[i + 1] = 255; maskPixels.data[i + 2] = 255; maskPixels.data[i + 3] = alpha; }
      maskCtx.putImageData(maskPixels, 0, 0);
      bgCtx.filter = `blur(${clamp(a.depthBlur, 0, 24)}px)`;
      bgCtx.drawImage(canvas, 0, 0); bgCtx.filter = "none";
      const subject = document.createElement("canvas"); subject.width = width; subject.height = height;
      const subjectCtx = subject.getContext("2d");
      if (subjectCtx) {
        subjectCtx.drawImage(canvas, 0, 0); subjectCtx.globalCompositeOperation = "destination-in"; subjectCtx.drawImage(maskCanvas, 0, 0);
        bgCtx.drawImage(subject, 0, 0); context.clearRect(0, 0, width, height); context.drawImage(background, 0, 0);
      }
      subject.width = subject.height = maskCanvas.width = maskCanvas.height = background.width = background.height = 1;
    }
  }

  if (a.warmth !== 0 || a.tint !== 0) {
    const warmth = clamp(a.warmth, -100, 100), tint = clamp(a.tint, -100, 100);
    context.save(); context.globalCompositeOperation = "soft-light";
    if (warmth) { context.fillStyle = warmth > 0 ? `rgba(255,150,55,${Math.abs(warmth) / 900})` : `rgba(65,135,255,${Math.abs(warmth) / 1050})`; context.fillRect(0, 0, width, height); }
    if (tint) { context.fillStyle = tint > 0 ? `rgba(180,70,125,${Math.abs(tint) / 1100})` : `rgba(70,180,145,${Math.abs(tint) / 1100})`; context.fillRect(0, 0, width, height); }
    context.restore();
  }
  if (a.sharpen > 0) {
    const amount = clamp(a.sharpen, 0, 1) * .22;
    const detail = document.createElement("canvas"); detail.width = width; detail.height = height;
    const detailContext = detail.getContext("2d");
    if (detailContext) { detailContext.filter = "contrast(1.8)"; detailContext.drawImage(canvas, 0, 0); context.save(); context.globalAlpha = amount; context.globalCompositeOperation = "overlay"; context.drawImage(detail, 0, 0); context.restore(); }
    detail.width = detail.height = 1;
  }
  const noiseStrength = clamp(Math.log2(Math.max(100, options.current.iso) / 100) * .018, 0, .12);
  if (noiseStrength > .002) {
    const noise = buildNoiseTexture(options.current.iso); context.save(); context.globalAlpha = noiseStrength;
    context.globalCompositeOperation = "soft-light"; context.imageSmoothingEnabled = false; context.drawImage(noise, 0, 0, width, height); context.restore();
  }
}

export function photoLabDownloadName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "photo";
  return `${base}-lens-lab.jpg`;
}
