export interface ExifMetadata {
  cameraMake?: string; cameraModel?: string; lensModel?: string; dateTimeOriginal?: string;
  aperture?: number; shutterSeconds?: number; iso?: number; focalLengthMm?: number;
  orientation?: number; imageWidth?: number; imageHeight?: number; gpsPresent: boolean;
}

function readTiff(view: DataView, start: number, length: number): ExifMetadata {
  const result: ExifMetadata = { gpsPresent: false };
  if (length < 8) return result;
  const little = view.getUint16(start, false) === 0x4949;
  if (!little && view.getUint16(start, false) !== 0x4d4d) return result;
  const u16 = (p: number) => view.getUint16(p, little);
  const u32 = (p: number) => view.getUint32(p, little);
  if (u16(start + 2) !== 42) return result;
  const base = start;
  const readIfd = (offset: number, depth: number) => {
    if (depth > 2 || offset < 8 || offset + 2 > length) return;
    const p = base + offset; const count = Math.min(u16(p), 512);
    for (let i = 0; i < count; i++) {
      const entry = p + 2 + i * 12; if (entry + 12 > base + length) break;
      const tag = u16(entry), type = u16(entry + 2), n = u32(entry + 4);
      const size = ({1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8} as Record<number,number>)[type] ?? 0;
      if (!size || n > 100_000) continue;
      const bytes = size * n; const data = bytes <= 4 ? entry + 8 : base + u32(entry + 8);
      if (data < base || data + bytes > base + length) continue;
      if (tag === 0x8769) { readIfd(u32(entry + 8), depth + 1); continue; }
      if (tag === 0x8825) { result.gpsPresent = true; continue; }
      if (tag === 0xA005) { readIfd(u32(entry + 8), depth + 1); continue; }
      if (tag === 0x0110 || tag === 0x010f || tag === 0x9003 || tag === 0xA434) {
        const text = new Uint8Array(view.buffer, data, Math.min(bytes, 256));
        const value = new TextDecoder().decode(text).replace(/\0.*$/s, "").trim();
        if (tag === 0x010f) result.cameraMake = value;
        if (tag === 0x0110) result.cameraModel = value;
        if (tag === 0x9003) result.dateTimeOriginal = value;
        if (tag === 0xA434) result.lensModel = value;
      }
      if (tag === 0x0112 && type === 3) result.orientation = u16(data);
      if ((tag === 0x829d || tag === 0x829a || tag === 0x920a) && type === 5 && n >= 1) {
        const numerator = u32(data), denominator = u32(data + 4);
        if (denominator) result[tag === 0x829d ? "aperture" : tag === 0x829a ? "shutterSeconds" : "focalLengthMm"] = numerator / denominator;
      }
      if (tag === 0x8827 && (type === 3 || type === 4)) result.iso = type === 3 ? u16(data) : u32(data);
      if ((tag === 0xA002 || tag === 0xA003) && (type === 3 || type === 4)) result[tag === 0xA002 ? "imageWidth" : "imageHeight"] = type === 3 ? u16(data) : u32(data);
    }
  };
  readIfd(u32(base + 4), 0);
  return result;
}

/** Reads common EXIF IFD tags from JPEG APP1 segments without a third-party dependency. */
export async function readExif(file: Blob): Promise<ExifMetadata> {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 2_000_000)).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const empty: ExifMetadata = { gpsPresent: false };
  // PNG eXIf chunk stores a TIFF header without the JPEG Exif\0\0 prefix.
  if (bytes.length >= 12 && bytes[0] === 0x89 && String.fromCharCode(...bytes.subarray(1,4)) === "PNG") {
    let p = 8;
    while (p + 12 <= bytes.length) { const length = view.getUint32(p, false); const type = String.fromCharCode(...bytes.subarray(p+4,p+8)); if (p+12+length>bytes.length) break; if (type === "eXIf") return readTiff(view,p+8,length); p += 12+length; if(type === "IEND") break; }
    return empty;
  }
  // WebP EXIF chunk may contain an optional Exif\0\0 prefix.
  if (bytes.length >= 16 && String.fromCharCode(...bytes.subarray(0,4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8,12)) === "WEBP") {
    let p=12; while(p+8<=bytes.length){const type=String.fromCharCode(...bytes.subarray(p,p+4));const length=view.getUint32(p+4,true);const data=p+8;if(data+length>bytes.length)break;if(type==="EXIF"){const prefix=length>=6&&String.fromCharCode(...bytes.subarray(data,data+4))==="Exif"?6:0;return readTiff(view,data+prefix,length-prefix);}p=data+length+(length%2);}
    return empty;
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return empty;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1]; offset += 2;
    if (marker === 0xda || marker === 0xd9) break;
    const size = view.getUint16(offset, false);
    if (size < 2 || offset + size > bytes.length) break;
    const dataStart = offset + 2, dataLength = size - 2;
    if (marker === 0xe1 && dataLength > 14 && String.fromCharCode(...bytes.subarray(dataStart, dataStart + 6)) === "Exif\0\0") {
      return readTiff(view, dataStart + 6, dataLength - 6);
    }
    offset += size;
  }
  return empty;
}

export async function sha256Fingerprint(file: Blob): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export interface RgbHistogram { red: number[]; green: number[]; blue: number[]; luminance: number[]; samples: number; }
export function calculateRgbHistogram(source: CanvasImageSource, width: number, height: number, bins = 64): RgbHistogram {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 512 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas pixel inspection is unavailable.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const result: RgbHistogram = { red: Array(bins).fill(0), green: Array(bins).fill(0), blue: Array(bins).fill(0), luminance: Array(bins).fill(0), samples: 0 };
  for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    result.red[Math.min(bins - 1, Math.floor(r / 256 * bins))]++;
    result.green[Math.min(bins - 1, Math.floor(g / 256 * bins))]++;
    result.blue[Math.min(bins - 1, Math.floor(b / 256 * bins))]++;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    result.luminance[Math.min(bins - 1, Math.floor(y / 256 * bins))]++;
    result.samples++;
  }
  return result;
}

export function cropRectFromFractions(width: number, height: number, left: number, top: number, right: number, bottom: number) {
  const x = Math.round(width * Math.max(0, Math.min(.9, left)));
  const y = Math.round(height * Math.max(0, Math.min(.9, top)));
  const w = Math.max(1, Math.round(width * (1 - Math.max(0, Math.min(.9, left)) - Math.max(0, Math.min(.9, right)))));
  const h = Math.max(1, Math.round(height * (1 - Math.max(0, Math.min(.9, top)) - Math.max(0, Math.min(.9, bottom)))));
  return { x, y, width: Math.min(w, width - x), height: Math.min(h, height - y) };
}
