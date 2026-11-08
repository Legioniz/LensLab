import type { CaptureRecord } from "../types/camera";
import type { PresetRecord } from "../types/preset";
import type { PhotoRecipeRecord } from "../types/recipe";

const DB_NAME = "lens-lab-local";
const DB_VERSION = 3;
const CAPTURES = "captures";
const PRESETS = "presets";
const LOGS = "logs";
const PHOTO_RECIPES = "photoRecipes";
const PERSISTENT_LOG_LIMIT = 2000;

export interface AppLogRecord {
  id: string;
  time: number;
  level: "info" | "warn" | "error";
  area: string;
  message: string;
  details?: string;
}

// Session fallback is populated only for records that could not be persisted.
const memoryCaptures = new Map<string, CaptureRecord>();
const memoryPresets = new Map<string, PresetRecord>();
const memoryPhotoRecipes = new Map<string, PhotoRecipeRecord>();
const memoryLogs: AppLogRecord[] = [];
const deletedCaptureIds = new Set<string>();
const deletedPresetIds = new Set<string>();
const deletedPhotoRecipeIds = new Set<string>();
const deletedLogIds = new Set<string>();

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `record-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    let settled = false;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (error) { reject(error); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CAPTURES)) {
        const store = db.createObjectStore(CAPTURES, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(PRESETS)) {
        const store = db.createObjectStore(PRESETS, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains(LOGS)) {
        const store = db.createObjectStore(LOGS, { keyPath: "id" });
        store.createIndex("time", "time");
      }
      if (!db.objectStoreNames.contains(PHOTO_RECIPES)) {
        const store = db.createObjectStore(PHOTO_RECIPES, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      settled = true;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error("IndexedDB could not be opened."));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Storage upgrade is blocked by another LENS LAB tab. Close other tabs and retry."));
    };
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

function getAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error(`Could not read ${storeName}.`));
  });
}

function mergeById<T extends { id: string }>(persistent: T[], fallback: Iterable<T>): T[] {
  const merged = new Map(persistent.map((item) => [item.id, item]));
  for (const item of fallback) if (!merged.has(item.id)) merged.set(item.id, item);
  return [...merged.values()];
}

export async function listCaptures(): Promise<CaptureRecord[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    const records = db ? await getAll<CaptureRecord>(db, CAPTURES) : [];
    const visible = records.filter((record) => !deletedCaptureIds.has(record.id));
    return mergeById(visible, memoryCaptures.values()).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [...memoryCaptures.values()].sort((a, b) => b.createdAt - a.createdAt);
  } finally { db?.close(); }
}

export async function saveCapture(capture: CaptureRecord): Promise<boolean> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) { memoryCaptures.set(capture.id, capture); return false; }
    const tx = db.transaction(CAPTURES, "readwrite");
    tx.objectStore(CAPTURES).put(capture);
    await transactionDone(tx);
    memoryCaptures.delete(capture.id);
    deletedCaptureIds.delete(capture.id);
    return true;
  } catch {
    memoryCaptures.set(capture.id, capture);
    deletedCaptureIds.delete(capture.id);
    return false;
  } finally { db?.close(); }
}

export async function deleteCapture(id: string): Promise<boolean> {
  memoryCaptures.delete(id);
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) return false;
    const tx = db.transaction(CAPTURES, "readwrite");
    tx.objectStore(CAPTURES).delete(id);
    await transactionDone(tx);
    deletedCaptureIds.delete(id);
    return true;
  } catch { deletedCaptureIds.add(id); return false; }
  finally { db?.close(); }
}

export async function clearCaptures(): Promise<boolean> {
  memoryCaptures.clear();
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) return false;
    const tx = db.transaction(CAPTURES, "readwrite");
    tx.objectStore(CAPTURES).clear();
    await transactionDone(tx);
    deletedCaptureIds.clear();
    return true;
  } catch {
    // Hide existing persisted items for this session when deletion cannot be committed.
    try {
      const retryDb = await openDatabase();
      if (retryDb) {
        const existing = await getAll<CaptureRecord>(retryDb, CAPTURES);
        existing.forEach((record) => deletedCaptureIds.add(record.id));
        retryDb.close();
      }
    } catch { /* Session memory remains cleared. */ }
    return false;
  }
  finally { db?.close(); }
}

export async function listPresets(): Promise<PresetRecord[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    const records = db ? await getAll<PresetRecord>(db, PRESETS) : [];
    const visible = records.filter((record) => !deletedPresetIds.has(record.id));
    return mergeById(visible, memoryPresets.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [...memoryPresets.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  } finally { db?.close(); }
}

export async function savePreset(record: PresetRecord): Promise<boolean> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) { memoryPresets.set(record.id, record); return false; }
    const tx = db.transaction(PRESETS, "readwrite");
    tx.objectStore(PRESETS).put(record);
    await transactionDone(tx);
    memoryPresets.delete(record.id);
    deletedPresetIds.delete(record.id);
    return true;
  } catch {
    memoryPresets.set(record.id, record);
    deletedPresetIds.delete(record.id);
    return false;
  } finally { db?.close(); }
}

export async function deletePreset(id: string): Promise<boolean> {
  memoryPresets.delete(id);
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) return false;
    const tx = db.transaction(PRESETS, "readwrite");
    tx.objectStore(PRESETS).delete(id);
    await transactionDone(tx);
    deletedPresetIds.delete(id);
    return true;
  } catch { deletedPresetIds.add(id); return false; }
  finally { db?.close(); }
}


export async function listPhotoRecipes(): Promise<PhotoRecipeRecord[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    const records = db ? await getAll<PhotoRecipeRecord>(db, PHOTO_RECIPES) : [];
    const visible = records.filter((record) => !deletedPhotoRecipeIds.has(record.id));
    return mergeById(visible, memoryPhotoRecipes.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [...memoryPhotoRecipes.values()].filter((record) => !deletedPhotoRecipeIds.has(record.id)).sort((a, b) => b.updatedAt - a.updatedAt);
  } finally { db?.close(); }
}

export async function savePhotoRecipe(record: PhotoRecipeRecord): Promise<boolean> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) { memoryPhotoRecipes.set(record.id, record); return false; }
    const tx = db.transaction(PHOTO_RECIPES, "readwrite");
    tx.objectStore(PHOTO_RECIPES).put(record);
    await transactionDone(tx);
    memoryPhotoRecipes.delete(record.id);
    deletedPhotoRecipeIds.delete(record.id);
    return true;
  } catch {
    memoryPhotoRecipes.set(record.id, record);
    deletedPhotoRecipeIds.delete(record.id);
    return false;
  } finally { db?.close(); }
}

export async function deletePhotoRecipe(id: string): Promise<boolean> {
  memoryPhotoRecipes.delete(id);
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) { deletedPhotoRecipeIds.add(id); return false; }
    const tx = db.transaction(PHOTO_RECIPES, "readwrite");
    tx.objectStore(PHOTO_RECIPES).delete(id);
    await transactionDone(tx);
    deletedPhotoRecipeIds.delete(id);
    return true;
  } catch { deletedPhotoRecipeIds.add(id); return false; }
  finally { db?.close(); }
}

export async function appendLog(entry: Omit<AppLogRecord, "id" | "time">): Promise<void> {
  const record: AppLogRecord = { ...entry, id: makeId(), time: Date.now() };
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) { pushMemoryLog(record); return; }
    const tx = db.transaction(LOGS, "readwrite");
    const store = tx.objectStore(LOGS);
    store.put(record);
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      let excess = Math.max(0, countRequest.result - PERSISTENT_LOG_LIMIT);
      if (excess === 0) return;
      const cursorRequest = store.index("time").openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || excess <= 0) return;
        cursor.delete();
        excess -= 1;
        cursor.continue();
      };
    };
    await transactionDone(tx);
    deletedLogIds.delete(record.id);
  } catch { pushMemoryLog(record); }
  finally { db?.close(); }
}

function pushMemoryLog(record: AppLogRecord): void {
  memoryLogs.push(record);
  if (memoryLogs.length > 1000) memoryLogs.splice(0, memoryLogs.length - 1000);
}

export async function listLogs(limit = 500): Promise<AppLogRecord[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    const records = db ? await getAll<AppLogRecord>(db, LOGS) : [];
    const visible = records.filter((record) => !deletedLogIds.has(record.id));
    return mergeById(visible, memoryLogs).sort((a, b) => b.time - a.time).slice(0, limit);
  } catch {
    return memoryLogs.slice(-limit).reverse();
  } finally { db?.close(); }
}

export async function clearLogs(): Promise<boolean> {
  memoryLogs.length = 0;
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    if (!db) return false;
    const tx = db.transaction(LOGS, "readwrite");
    tx.objectStore(LOGS).clear();
    await transactionDone(tx);
    deletedLogIds.clear();
    return true;
  } catch {
    try {
      const retryDb = await openDatabase();
      if (retryDb) {
        const existing = await getAll<AppLogRecord>(retryDb, LOGS);
        existing.forEach((record) => deletedLogIds.add(record.id));
        retryDb.close();
      }
    } catch { /* Session-side log history remains cleared. */ }
    return false;
  } finally { db?.close(); }
}
