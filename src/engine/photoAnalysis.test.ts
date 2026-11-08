import { describe, expect, it } from "vitest";
import { cropRectFromFractions, readExif, sha256Fingerprint } from "./photoAnalysis";
import { createZipStore } from "./zipStore";

describe("photo analysis and portable batch tools", () => {
  it("calculates a bounded crop rectangle", () => {
    expect(cropRectFromFractions(1000, 500, .1, .1, .1, .1)).toEqual({ x: 100, y: 50, width: 800, height: 400 });
  });
  it("returns an empty metadata result for a non-EXIF image", async () => {
    const result = await readExif(new Blob([new Uint8Array([0,1,2,3])]));
    expect(result.gpsPresent).toBe(false);
    expect(result.cameraModel).toBeUndefined();
  });
  it("reads a camera model from a minimal JPEG EXIF APP1 block", async () => {
    const tiff = new Uint8Array(32); const view = new DataView(tiff.buffer);
    tiff.set([0x49,0x49]); view.setUint16(2,42,true); view.setUint32(4,8,true); view.setUint16(8,1,true);
    view.setUint16(10,0x0110,true); view.setUint16(12,2,true); view.setUint32(14,6,true); view.setUint32(18,26,true);
    tiff.set(new TextEncoder().encode("Canon\0"),26);
    const jpeg = new Uint8Array(2+2+2+6+tiff.length+2); let p=0;
    jpeg.set([0xff,0xd8,0xff,0xe1],p);p+=4;new DataView(jpeg.buffer).setUint16(p,38+2,false);p+=2;
    jpeg.set(new TextEncoder().encode("Exif\0\0"),p);p+=6;jpeg.set(tiff,p);p+=tiff.length;jpeg.set([0xff,0xd9],p);
    const result=await readExif(new Blob([jpeg],{type:"image/jpeg"}));
    expect(result.cameraModel).toBe("Canon");
  });
  it("creates a ZIP archive with a valid local-file signature", async () => {
    const blob = createZipStore([{ name: "sample.txt", data: new TextEncoder().encode("lens lab") }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50); expect(bytes[1]).toBe(0x4b); expect(bytes[2]).toBe(0x03); expect(bytes[3]).toBe(0x04);
  });
  it("uses SHA-256 when Web Crypto is available", async () => {
    const result = await sha256Fingerprint(new Blob(["LENS LAB"]));
    if (result !== null) expect(result).toMatch(/^[a-f0-9]{64}$/);
  });
});
