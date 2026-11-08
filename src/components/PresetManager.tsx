import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Bookmark, Download, FileText, FileUp, History, Plus, Search, Trash2, Upload } from "lucide-react";
import type { CameraMode, CameraSettings } from "../types/camera";
import type { PresetDocument, PresetRecord } from "../types/preset";
import { createPresetRecord, importPresetRecord, parsePresetText, updatePresetRecord, type PresetDraft } from "../engine/presets";
import { deletePreset, listPresets, savePreset } from "../storage/database";
import { logError, logInfo } from "../utils/logger";

interface PresetManagerProps {
  current: Omit<PresetDraft, "name" | "description">;
  onApply: (preset: PresetDocument) => void;
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PresetManager({ current, onApply }: PresetManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<PresetRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = records.find((record) => record.id === selectedId) ?? null;
  const filtered = useMemo(() => records.filter((record) => `${record.name} ${record.description}`.toLowerCase().includes(query.toLowerCase())), [records, query]);

  async function refresh() { setRecords(await listPresets()); }
  useEffect(() => { void refresh(); }, []);

  function makeDraft(): PresetDraft {
    return { ...current, name: name.trim(), description: description.trim() };
  }

  async function create() {
    if (!name.trim()) { setError("Give the preset a name first."); return; }
    setBusy(true); setError("");
    try {
      const record = createPresetRecord(makeDraft());
      const persisted = await savePreset(record);
      await refresh(); setSelectedId(record.id);
      setNotice(persisted ? `Created ${record.name} · version 1.` : "Created for this session. Browser storage is unavailable, so export the TXT file to keep it.");
      logInfo("presets", "Preset created", { id: record.id, name: record.name, version: 1, persisted });
      downloadText(`${record.name.replace(/[^a-z0-9_-]+/gi, "-")}.lenspreset.txt`, record.currentText);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Preset could not be created."); logError("presets", "Create preset failed", reason); }
    finally { setBusy(false); }
  }

  async function saveRevision() {
    if (!selected || !name.trim()) { setError("Select a preset and provide a name."); return; }
    setBusy(true); setError("");
    try {
      const updated = updatePresetRecord(selected, makeDraft());
      const persisted = await savePreset(updated);
      await refresh(); setSelectedId(updated.id);
      setNotice(persisted ? `Saved new revision v${updated.currentVersion}.` : "Revision saved for this session only. Export the TXT file for a persistent copy.");
      logInfo("presets", "Preset revision saved", { id: updated.id, version: updated.currentVersion, persisted });
      downloadText(`${updated.name.replace(/[^a-z0-9_-]+/gi, "-")}-v${updated.currentVersion}.lenspreset.txt`, updated.currentText);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Preset revision could not be saved."); logError("presets", "Update preset failed", reason); }
    finally { setBusy(false); }
  }

  async function removeSelected() {
    if (!selected || !window.confirm(`Delete '${selected.name}' and its local version history? Exported TXT files will not be affected.`)) return;
    const id = selected.id;
    const persisted = await deletePreset(id);
    await refresh(); setSelectedId(null); setName(""); setDescription("");
    setNotice(persisted ? "Preset and version history deleted." : "Preset removed from this session. Persistent storage was unavailable.");
    logInfo("presets", "Preset deleted", { id, persisted });
  }

  function selectRecord(record: PresetRecord) {
    setSelectedId(record.id); setName(record.name); setDescription(record.description); setError(""); setNotice("");
  }

  function exportRecord(record: PresetRecord, versionText?: string, version?: number) {
    const parsed = parsePresetText(versionText ?? record.currentText);
    downloadText(`${parsed.name.replace(/[^a-z0-9_-]+/gi, "-")}-v${version ?? record.currentVersion}.lenspreset.txt`, versionText ?? record.currentText);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 256_000) { setError("Preset TXT files must be smaller than 256 KB."); return; }
    setBusy(true); setError("");
    try {
      const text = await file.text();
      const imported = importPresetRecord(text);
      const persisted = await savePreset(imported);
      await refresh(); setSelectedId(imported.id); setName(imported.name); setDescription(imported.description);
      setNotice(persisted ? `Imported '${imported.name}' as a new local preset.` : "Imported for this session only. Export it to preserve a copy.");
      logInfo("presets", "Preset imported", { sourceFile: file.name, id: imported.id, persisted });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Preset import failed."); logError("presets", "Preset import failed", reason); }
    finally { setBusy(false); }
  }

  async function restoreVersion(record: PresetRecord, version: number, text: string) {
    try {
      const doc = parsePresetText(text);
      const restored = updatePresetRecord(record, {
        name: doc.name, description: doc.description,
        cameraProfileId: doc.cameraProfileId, lensProfileId: doc.lensProfileId,
        mode: doc.mode as CameraMode, sceneId: doc.sceneId, settings: doc.settings as CameraSettings,
      });
      const persisted = await savePreset(restored); await refresh(); setSelectedId(restored.id);
      downloadText(`${restored.name.replace(/[^a-z0-9_-]+/gi, "-")}-v${restored.currentVersion}.lenspreset.txt`, restored.currentText);
      setNotice(`Restored v${version} as a new revision v${restored.currentVersion}${persisted ? "." : " for this session."}`);
      logInfo("presets", "Preset version restored", { id: record.id, fromVersion: version, newVersion: restored.currentVersion });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Version could not be restored."); }
  }

  return (
    <section className="content-page preset-page">
      <div className="page-heading"><div><div className="section-kicker">REUSABLE CAMERA CONFIGURATIONS</div><h1>Preset library <span>/ VERSIONED SETTINGS</span></h1><p>Save reusable camera settings as readable TXT files. Every update creates a revision you can inspect or restore.</p></div><div className="preset-actions"><button className="subtle-button" onClick={() => inputRef.current?.click()}><FileUp size={14}/> IMPORT TXT</button><input ref={inputRef} type="file" accept=".txt,.lenspreset.txt,text/plain" hidden onChange={(event) => void importFile(event)}/></div></div>
      <div className="preset-intro"><Bookmark size={18}/><div><b>Portable, human-readable presets</b><p>Presets stay in this browser and can also be exported as `.lenspreset.txt`. Edit the JSON block in a text editor and import it again. Each local update preserves an immutable version snapshot.</p></div></div>
      <div className="preset-layout" data-guide="preset-manager">
        <div className="preset-list-card">
          <div className="preset-list-heading"><h3>Saved presets <span>{records.length}</span></h3><label className="preset-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a preset" aria-label="Search presets"/></label></div>
          <div className="preset-list">
            {filtered.map((record) => <button key={record.id} className={`preset-list-item ${selectedId === record.id ? "selected" : ""}`} onClick={() => selectRecord(record)}><span className="preset-list-icon"><Bookmark size={16}/></span><span><b>{record.name}</b><small>{record.description || "No description"}</small></span><em>v{record.currentVersion}</em></button>)}
            {!filtered.length && <div className="preset-empty"><FileText size={22}/><b>{records.length ? "No matching presets" : "No presets yet"}</b><span>Save the current camera settings to create your first reusable preset.</span></div>}
          </div>
        </div>

        <div className="preset-editor-card">
          <div className="settings-card-heading"><div className="settings-icon"><FileText size={18}/></div><div><h3>{selected ? "Preset details" : "Create a preset"}</h3><p>{selected ? `Current revision v${selected.currentVersion} · ${selected.versions.length} saved version(s)` : "Capture your current Studio settings as a reusable file."}</p></div></div>
          <label className="settings-field">PRESET NAME<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="e.g. Outdoor portrait — soft light"/></label>
          <label className="settings-field">DESCRIPTION<textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the intended lighting or subject..." rows={3}/></label>
          <div className="preset-current-settings"><div><span>MODE</span><b>{current.mode}</b></div><div><span>APERTURE</span><b>f/{current.settings.aperture.toFixed(1)}</b></div><div><span>SHUTTER</span><b>{current.settings.shutter >= 1 ? `${current.settings.shutter}s` : `1/${Math.round(1 / current.settings.shutter)}`}</b></div><div><span>ISO</span><b>{current.settings.iso}</b></div><div><span>FOCAL LENGTH</span><b>{current.settings.focalLength}mm</b></div></div>
          <div className="preset-editor-actions">
            <button className="primary-button" disabled={busy || !name.trim()} onClick={() => void (selected ? saveRevision() : create())}>{selected ? <History size={14}/> : <Plus size={14}/>} {selected ? "SAVE NEW REVISION" : "CREATE PRESET"}</button>
            {selected && <><button className="subtle-button" onClick={() => { try { onApply(parsePresetText(selected.currentText)); setNotice("Preset settings loaded into Studio."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Preset is invalid."); } }}><Upload size={14}/> LOAD INTO STUDIO</button><button className="subtle-button" onClick={() => exportRecord(selected)}><Download size={14}/> EXPORT TXT</button><button className="subtle-button danger-button" onClick={() => void removeSelected()}><Trash2 size={14}/></button></>}
          </div>
          {selected && <div className="preset-history"><div className="preset-history-heading"><History size={15}/> VERSION HISTORY</div>{[...selected.versions].reverse().map((version) => <div className="preset-version" key={version.version}><div><b>v{version.version}</b><small>{new Date(version.savedAt).toLocaleString()}</small></div><div>{version.version === selected.currentVersion && <span className="current-version-tag">CURRENT</span>}<button onClick={() => exportRecord(selected, version.text, version.version)}>TXT</button>{version.version !== selected.currentVersion && <button onClick={() => void restoreVersion(selected, version.version, version.text)}>RESTORE</button>}</div></div>)}</div>}
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}
      <div className="photo-lab-disclaimer"><FileText size={15}/> A preset is a camera-settings snapshot, not a copy of the photograph. The source image remains separate. Importing a file creates a new library item so existing revision history is not overwritten.</div>
    </section>
  );
}
