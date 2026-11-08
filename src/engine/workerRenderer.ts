let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (bitmap: ImageBitmap) => void; reject: (error: Error) => void; timer: number }>();
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/photoProcessor.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; bitmap?: ImageBitmap; error?: string }>) => {
      const task = pending.get(event.data.id); if (!task) { event.data.bitmap?.close(); return; }
      window.clearTimeout(task.timer); pending.delete(event.data.id);
      if (event.data.bitmap) task.resolve(event.data.bitmap); else task.reject(new Error(event.data.error || "Worker rendering failed."));
    };
    worker.onerror = () => {
      for (const task of pending.values()) { window.clearTimeout(task.timer); task.reject(new Error("Image worker failed; using main-thread fallback.")); }
      pending.clear(); worker?.terminate(); worker = null;
    };
  }
  return worker;
}
export async function renderBitmapInWorker(source: HTMLImageElement, width: number, height: number, filter: string, rotation = 0): Promise<ImageBitmap> {
  if (typeof Worker === "undefined" || typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") throw new Error("Worker image rendering is not supported.");
  const bitmap = await createImageBitmap(source);
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { pending.delete(id); bitmap.close(); reject(new Error("Image worker timed out.")); }, 15_000);
    pending.set(id, { resolve, reject, timer });
    try { getWorker().postMessage({ id, bitmap, width, height, filter, rotation }, [bitmap]); }
    catch (error) { window.clearTimeout(timer); pending.delete(id); reject(error instanceof Error ? error : new Error("Could not transfer image to worker.")); }
  });
}
export function disposePhotoWorker() { worker?.terminate(); worker = null; for (const task of pending.values()) { window.clearTimeout(task.timer); task.reject(new Error("Image worker disposed.")); } pending.clear(); }
