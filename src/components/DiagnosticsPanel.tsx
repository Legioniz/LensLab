import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw, Search, Trash2 } from "lucide-react";
import { clearLogs, listLogs, type AppLogRecord } from "../storage/database";

export default function DiagnosticsPanel() {
  const [logs, setLogs] = useState<AppLogRecord[]>([]);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => logs.filter((log) => (level === "all" || log.level === level) && `${log.area} ${log.message} ${log.details ?? ""}`.toLowerCase().includes(query.toLowerCase())), [logs, query, level]);

  async function refresh() { setLogs(await listLogs(1000)); }
  useEffect(() => { void refresh(); }, []);

  function exportLog() {
    const text = logs.map((log) => `[${new Date(log.time).toISOString()}] [${log.level.toUpperCase()}] [${log.area}] ${log.message}${log.details ? `\n${log.details}` : ""}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([text || "No diagnostic events recorded."], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `lens-lab-diagnostics-${new Date().toISOString().slice(0, 10)}.log`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function clear() {
    if (!window.confirm("Clear the browser-side LENS LAB diagnostics? The separate Windows launcher log will remain on disk.")) return;
    const persistent = await clearLogs(); await refresh(); setMessage(persistent ? "Browser diagnostics cleared." : "Logs hidden for this session; persistent browser storage could not confirm the deletion.");
  }

  return (
    <div className="settings-card diagnostics-card">
      <div className="settings-card-heading"><div className="settings-icon"><FileText size={18}/></div><div><h3>Diagnostics and process log</h3><p>Search runtime events, warnings, and errors stored locally in this browser.</p></div></div>
      <div className="diagnostics-toolbar"><label className="preset-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search log messages" aria-label="Search diagnostic logs"/></label><select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Filter log level"><option value="all">All levels</option><option value="error">Errors</option><option value="warn">Warnings</option><option value="info">Information</option></select></div>
      <div className="diagnostics-log-list">
        {filtered.slice(0, 80).map((log) => <article className={`diagnostic-entry level-${log.level}`} key={log.id}><div><b>{log.level.toUpperCase()}</b><span>{log.area}</span><time>{new Date(log.time).toLocaleString()}</time></div><p>{log.message}</p>{log.details && <pre>{log.details}</pre>}</article>)}
        {!filtered.length && <div className="preset-empty"><FileText size={20}/><span>No log entries match this search.</span></div>}
      </div>
      <div className="diagnostics-actions"><span>{filtered.length} visible / {logs.length} stored</span><div><button className="subtle-button" onClick={() => void refresh()}><RefreshCw size={14}/> REFRESH</button><button className="subtle-button" onClick={exportLog}><Download size={14}/> EXPORT .LOG</button><button className="subtle-button danger-button" onClick={() => void clear()}><Trash2 size={14}/> CLEAR</button></div></div>
      {message && <small className="diagnostics-message">{message}</small>}
      <p className="settings-warning">Browser diagnostics are persisted in IndexedDB when available. The Windows launcher writes a separate plain-text log to <code>logs/launcher.log</code>. If browser storage is unavailable, browser log entries remain in memory until the tab closes.</p>
    </div>
  );
}
