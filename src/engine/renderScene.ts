import type { CameraProfile, CameraSettings, QualityMode, SceneDefinition } from "../types/camera";
import { calculateExposureOffset } from "./exposure";

const imageCache = new Map<string, HTMLImageElement>();
const noiseCache = new Map<number, HTMLCanvasElement>();
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  if (cached?.complete && cached.naturalWidth === 0) imageCache.delete(src);
  else if (cached) return new Promise((resolve, reject) => {
    cached.addEventListener("load", () => resolve(cached), { once: true });
    cached.addEventListener("error", () => {
      imageCache.delete(src);
      reject(new Error(`Scene asset failed to load: ${src}`));
    }, { once: true });
  });
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  imageCache.set(src, image);
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => {
    imageCache.delete(src);
    reject(new Error(`Scene asset failed to load: ${src}`));
  };
  });
}

function getNoiseTexture(iso: number): HTMLCanvasElement {
  const bucket = Math.min(51200, Math.max(100, Math.round(iso / 400) * 400));
  const cached = noiseCache.get(bucket);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 120;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  const image = ctx.createImageData(canvas.width, canvas.height);
  let seed = bucket * 7919;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = (seed / 2147483647) * 255;
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = n;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  if (noiseCache.size >= 8) noiseCache.delete(noiseCache.keys().next().value as number);
  noiseCache.set(bucket, canvas);
  return canvas;
}

export interface RenderOptions {
  quality: QualityMode;
  showGrid?: boolean;
  includeViewfinderOverlays?: boolean;
  animateOffset?: number;
  signal?: AbortSignal;
}

export async function renderSceneToCanvas(
  canvas: HTMLCanvasElement,
  scene: SceneDefinition,
  settings: CameraSettings,
  camera: CameraProfile,
  options: RenderOptions,
): Promise<void> {
  const [background, subject] = await Promise.all([loadImage(scene.background), loadImage(scene.subject)]);
  if (options.signal?.aborted) return;
  const size = options.quality === "high" ? 1440 : options.quality === "eco" ? 900 : 1200;
  const width = size;
  const height = Math.round(size * 2 / 3);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas rendering is unavailable in this browser.");
  const exposureOffset = calculateExposureOffset(settings, scene);
  const exposureBrightness = 2 ** clamp(exposureOffset, -5, 5);
  const blurQuality = options.quality === "eco" ? 0.65 : 1;
  const sensorBlurScale = clamp(22.3 / camera.sensorWidthMm, 0.72, 1.45);
  const apertureBlur = clamp((2.8 / settings.aperture) * (settings.focalLength / 50) * 3.8 * sensorBlurScale, 0.15, 11) * blurQuality;
  const focusMismatch = Math.abs(settings.focusDistance - scene.subjectDistanceM);
  const subjectBlur = clamp(focusMismatch * (settings.focalLength / 50) * 0.9 + Math.max(0, apertureBlur - 5) * 0.12, 0, 8) * blurQuality;

  ctx.save();
  ctx.filter = `blur(${apertureBlur.toFixed(2)}px) brightness(${exposureBrightness.toFixed(3)}) saturate(${(1.04 - Math.max(0, settings.iso - 800) / 40000).toFixed(3)})`;
  ctx.drawImage(background, 0, 0, width, height);
  ctx.restore();

  // Motion blur grows with exposure duration. 1/250s is the baseline for this educational scene model.
  const motionBlur = scene.motion > 0.2 ? clamp((settings.shutter / (1 / 250) - 1) * 0.9, 0, 7) : 0;
  const drift = options.animateOffset ?? 0;
  if (motionBlur > 0.5) {
    ctx.save();
    ctx.globalAlpha = clamp(motionBlur / 9, 0.05, 0.32);
    ctx.filter = `blur(${(motionBlur * blurQuality).toFixed(1)}px)`;
    ctx.drawImage(subject, drift - motionBlur * 2, 0, width, height);
    ctx.restore();
  }
  ctx.save();
  ctx.filter = `blur(${subjectBlur.toFixed(2)}px) brightness(${exposureBrightness.toFixed(3)})`;
  ctx.drawImage(subject, drift, 0, width, height);
  ctx.restore();

  // Sensor noise is luminance-modulated by the rendered scene and rises with ISO.
  const noise = getNoiseTexture(settings.iso);
  const noiseStrength = clamp((Math.log2(settings.iso / 100) / 9) * 0.28, 0.008, 0.22);
  ctx.save();
  ctx.globalAlpha = noiseStrength;
  ctx.globalCompositeOperation = "soft-light";
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noise, 0, 0, width, height);
  ctx.restore();
  ctx.imageSmoothingEnabled = true;

  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.18, width / 2, height / 2, width * 0.66);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, `rgba(0,0,0,${clamp((settings.focalLength / 200) * 0.16 + (2.8 / settings.aperture) * 0.055, 0.025, 0.18)})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  if (exposureOffset > 1.15) {
    ctx.fillStyle = `rgba(255,248,228,${clamp((exposureOffset - 1.15) * 0.10, 0, 0.2)})`;
    ctx.fillRect(0, 0, width, height);
  }

  if (options.includeViewfinderOverlays) {
    if (options.showGrid) {
      ctx.strokeStyle = "rgba(255,255,255,.34)";
      ctx.lineWidth = Math.max(1, width / 1200);
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo((width / 3) * i, 0); ctx.lineTo((width / 3) * i, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, (height / 3) * i); ctx.lineTo(width, (height / 3) * i); ctx.stroke();
      }
    }
    const x = width / 2; const y = height / 2; const r = Math.max(17, width * 0.022);
    ctx.strokeStyle = "rgba(255,255,255,.76)"; ctx.lineWidth = Math.max(1, width / 1200);
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    ctx.beginPath(); ctx.moveTo(x - r * 1.4, y); ctx.lineTo(x - r * 0.55, y); ctx.moveTo(x + r * 0.55, y); ctx.lineTo(x + r * 1.4, y); ctx.stroke();
  }
}

export async function createCaptureBlob(
  scene: SceneDefinition,
  settings: CameraSettings,
  camera: CameraProfile,
  quality: QualityMode,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderSceneToCanvas(canvas, scene, settings, camera, { quality, includeViewfinderOverlays: false });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode this capture.")), "image/jpeg", 0.93);
  });
}
