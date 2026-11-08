interface RenderMessage { id: number; bitmap: ImageBitmap; width: number; height: number; filter: string; rotation: number; }
const workerScope = self as unknown as { onmessage: ((event: MessageEvent<RenderMessage>) => void) | null; postMessage(message: unknown, transfer?: Transferable[]): void };
workerScope.onmessage = (event: MessageEvent<RenderMessage>) => {
  const { id, bitmap, width, height, filter, rotation } = event.data;
  try {
    if (typeof OffscreenCanvas === "undefined") throw new Error("OffscreenCanvas unavailable");
    const swapped = Math.abs(rotation % 180) === 90;
    const canvas = new OffscreenCanvas(swapped ? height : width, swapped ? width : height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("OffscreenCanvas 2D context unavailable");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.save(); context.translate(canvas.width / 2, canvas.height / 2); context.rotate(rotation * Math.PI / 180);
    context.filter = filter; context.drawImage(bitmap, -width / 2, -height / 2, width, height); context.restore();
    bitmap.close();
    const result = canvas.transferToImageBitmap(); workerScope.postMessage({ id, bitmap: result }, [result]);
  } catch (error) {
    bitmap.close(); workerScope.postMessage({ id, error: error instanceof Error ? error.message : "Worker render failed" });
  }
};
