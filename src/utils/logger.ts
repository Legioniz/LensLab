import { appendLog } from "../storage/database";

export function logInfo(area: string, message: string, details?: unknown): void {
  void appendLog({ level: "info", area, message, details: details === undefined ? undefined : safeDetails(details) });
}
export function logWarn(area: string, message: string, details?: unknown): void {
  void appendLog({ level: "warn", area, message, details: details === undefined ? undefined : safeDetails(details) });
}
export function logError(area: string, message: string, details?: unknown): void {
  void appendLog({ level: "error", area, message, details: details === undefined ? undefined : safeDetails(details) });
}
function safeDetails(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ""}`.slice(0, 8000);
  try { return JSON.stringify(value, null, 2).slice(0, 8000); }
  catch { return String(value).slice(0, 8000); }
}
