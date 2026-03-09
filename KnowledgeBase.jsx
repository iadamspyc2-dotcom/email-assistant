import { useState, useRef, useEffect } from "react";
import * as mammoth from "mammoth";

// ── SheetJS loaded via CDN script tag ────────────────────────────
function loadSheetJS() {
  return new Promise((resolve) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    document.head.appendChild(s);
  });
}

// ── Storage helpers ──────────────────────────────────────────────
async function loadStorage(key) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function saveStorage(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch (e) { console.error(e); }
}

const INITIAL_DATA = {
  projects: [], customers: [], industry: [],
  paycargo_vendors: [], paycargo_payers: [],
};

const SECTIONS = [
  { key: "projects",  label: "Projects",           icon: "📋", color: "#7c3aed", bg: "#ede9fe" },
  { key: "customers", label: "Customer Profiles",  icon: "🏭", color: "#0284c7", bg: "#dbeafe" },
  { key: "industry",  label: "Industry Knowledge", icon: "🌐", color: "#b45309", bg: "#fef3c7" },
  {
    key: "paycargo", label: "PayCargo Knowledge", icon: "🏢", color: "#0d9488", bg: "#ccfbf1",
    children: [
      { key: "paycargo_vendors", label: "Vendors", icon: "📦", color: "#059669", bg: "#d1fae5" },
      { key: "paycargo_payers",  label: "Payers",  icon: "💳", color: "#0284c7", bg: "#dbeafe" },
    ],
  },
];

const CUSTOMER_TAGS = ["Vendor", "Payer", "Partner", "Prospect", "Key Account"];

// ── File parser ──────────────────────────────────────────────────
async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const base = { id: Date.now(), name: file.name, ext, size: (file.size / 1024).toFixed(1) + " KB", date: new Date().toLocaleDateString() };

  // Excel / CSV
  if (["xlsx", "xls", "csv"].includes(ext)) {
    const XLSX = await loadSheetJS();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheets = {};
    wb.SheetNames.forEach(name => {
      const ws = wb.Sheets[name];
      sheets[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    });
    const firstSheet = sheets[wb.SheetNames[0]];
    const headers = firstSheet[0] || [];
    const rowCount = firstSheet.length - 1;
    const preview = firstSheet.slice(0, 6).map(r => r.join(" | ")).join("\n");
    return {
      ...base,
      type: "excel",
      sheetNames: wb.SheetNames,
      sheets,
      headers,
      rowCount,
      preview,
      extractedText: `Excel File: ${file.name}\nSheets: ${wb.SheetNames.join(", ")}\nRows: ${rowCount}\nColumns: ${headers.length}\n\nHeaders: ${headers.join(", ")}\n\nPreview:\n${preview}`,
    };
  }

  // Word .docx
  if (ext === "docx") {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    const text = result.value || "";
    return {
      ...base,
      type: "word",
      extractedText: text,
      preview: text.slice(0, 500),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  }

  // Plain text / markdown / CSV text
  if (["txt", "md"].includes(ext)) {
    const text = await file.text();
    return { ...base, type: "text", extractedText: text, preview: text.slice(0, 500) };
  }

  // PDF / PPTX — store as reference only
  return { ...base, type: "binary", extractedText: null, preview: null };
}

// ── Main Component ───────────────────────────────────────────────
export default function KnowledgeBase() {
  const [data, setData] = useState(INITIAL_DATA);
  const [open, setOpen] = useState({ projects: false, customers: false, industry: false, paycargo: false, paycargo_vendors: false, paycargo_payers: false });
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: "", content: "", tag: "", name: "", description: "", category: "Vendor" });
  const [search, setSearch] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeFileTab, setActiveFileTab] = useState(null); // { fileId, sheetName }
  const fileRef = useRef();
  const sectionFileRef = useRef();
  const [pendingSection, setPendingSection] = useState(null);

  useEffect(() => {
    (async () => {
      const saved = await loadStorage("kb-v3-data");
      if (saved) setData(saved);
      setLoading(false);
    })();
  }, []);

  const persist = async (updated) => { setData(updated); await saveStorage("kb-v3-data", updated); };
  const toggleOpen = (key) => setOpen(p => ({ ...p, [key]: !p[key] }));
  const totalCount = (key) => (data[key] || []).length;

  const addEntry = async (sectionKey) => {
    if (!form.title.trim()) return;
    const entry = { id: Date.now(), title: form.title, content: form.content, tag: form.tag, notes: [], files: [], date: new Date().toLocaleDateString() };
    const updated = { ...data, [sectionKey]: [...(data[sectionKey] || []), entry] };
    await persist(updated);
    setForm({ title: "", content: "", tag: "", name: "", description: "", category: "Vendor" });
    setModal(null);
  };

  const addProfile = async () => {
    if (!form.name.trim()) return;
    const profile = { id: Date.now(), title: form.name, name: form.name, description: form.description, category: form.category, notes: [], files: [], date: new Date().toLocaleDateString() };
    const updated = { ...data, customers: [...(data.customers || []), profile] };
    await persist(updated);
    setForm({ title: "", content: "", tag: "", name: "", description: "", category: "Vendor" });
    setModal(null);
  };

  const deleteEntry = async (sectionKey, id) => {
    const updated = { ...data, [sectionKey]: data[sectionKey].filter(e => e.id !== id) };
    await persist(updated);
    if (selected?.item?.id === id) setSelected(null);
  };

  const addNote = async () => {
    if (!noteInput.trim() || !selected) return;
    const note = { id: Date.now(), text: noteInput, date: new Date().toLocaleDateString() };
    const sk = selected.key;
    const updated = { ...data, [sk]: data[sk].map(e => e.id === selected.item.id ? { ...e, notes: [...(e.notes || []), note] } : e) };
    await persist(updated);
    setSelected({ ...selected, item: updated[sk].find(e => e.id === selected.item.id) });
    setNoteInput("");
  };

  // Upload file to an existing entry
  const handleFileUpload = async (e, sectionKey, itemId) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const parsed = await parseFile(file);
      const sk = sectionKey;
      const updated = { ...data, [sk]: data[sk].map(en => en.id === itemId ? { ...en, files: [...(en.files || []), parsed] } : en) };
      await persist(updated);
      const updatedItem = updated[sk].find(en => en.id === itemId);
      setSelected({ key: sk, item: updatedItem });
      setActiveFileTab({ fileId: parsed.id, sheetName: parsed.sheetNames?.[0] || null });
    } catch (err) {
      alert("Error parsing file: " + err.message);
    }
    setUploading(false);
    e.target.value = "";
  };

  // Upload file directly to a section (creates a new entry)
  const handleSectionFileUpload = async (e, sectionKey) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const parsed = await parseFile(file);
      const entry = {
        id: Date.now(),
        title: file.name,
        content: parsed.extractedText?.slice(0, 1000) || "",
        tag: parsed.ext?.toUpperCase() || "FILE",
        notes: [],
        files: [parsed],
        date: new Date().toLocaleDateString(),
      };
      const updated = { ...data, [sectionKey]: [...(data[sectionKey] || []), entry] };
      await persist(updated);
      setSelected({ key: sectionKey, item: entry });
      setActiveFileTab({ fileId: parsed.id, sheetName: parsed.sheetNames?.[0] || null });
    } catch (err) {
      alert("Error parsing file: " + err.message);
    }
    setUploading(false);
    e.target.value = "";
  };

  const getFiltered = (key) => {
    const items = data[key] || [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      i.title?.toLowerCase().includes(q) || i.name?.toLowerCase().includes(q) ||
      i.content?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
    );
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", color: "#0d9488", fontSize: 15 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter', system-ui, sans-serif", background: "#f8fafc", color: "#1e293b", overflow: "hidden" }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 280, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>📚 Knowledge Base</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all sections..." style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 10px", fontSize: 12, outline: "none", boxSizing: "border-box", background: "#f8fafc" }} />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {SECTIONS.map(section => (
            <div key={section.key}>
              <button onClick={() => toggleOpen(section.key)} style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, textAlign: "left" }}>
                <span style={{ fontSize: 10, color: "#94a3b8", display: "inline-block", transform: open[section.key] ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                <span style={{ fontSize: 15 }}>{section.icon}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{section.label}</span>
                <span style={{ fontSize: 11, background: section.bg, color: section.color, borderRadius: 10, padding: "2px 7px", fontWeight: 700 }}>
                  {section.children ? section.children.reduce((a, c) => a + totalCount(c.key), 0) : totalCount(section.key)}
                </span>
              </button>

              {open[section.key] && (
                <div style={{ background: "#fafafa" }}>
                  {section.children ? (
                    section.children.map(child => (
                      <div key={child.key}>
                        <button onClick={() => toggleOpen(child.key)} style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", padding: "8px 12px 8px 28px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, textAlign: "left" }}>
                          <span style={{ fontSize: 10, color: "#94a3b8", display: "inline-block", transform: open[child.key] ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                          <span style={{ fontSize: 13 }}>{child.icon}</span>
                          <span style={{ flex: 1, fontWeight: 600, fontSize: 12, color: "#374151" }}>{child.label}</span>
                          <span style={{ fontSize: 10, background: child.bg, color: child.color, borderRadius: 8, padding: "1px 6px", fontWeight: 700 }}>{totalCount(child.key)}</span>
                        </button>
                        {open[child.key] && (
                          <SectionItems items={getFiltered(child.key)} sectionKey={child.key} color={child.color} selected={selected}
                            onSelect={item => { setSelected({ key: child.key, item }); setActiveFileTab(null); }}
                            onAdd={() => setModal({ section: child.key, type: "entry", label: child.label })}
                            onUpload={(sk) => { setPendingSection(sk); sectionFileRef.current.click(); }}
                            indent={44} />
                        )}
                      </div>
                    ))
                  ) : (
                    <SectionItems items={getFiltered(section.key)} sectionKey={section.key} color={section.color} selected={selected}
                      onSelect={item => { setSelected({ key: section.key, item }); setActiveFileTab(null); }}
                      onAdd={() => setModal({ section: section.key, type: section.key === "customers" ? "profile" : "entry", label: section.label })}
                      onUpload={(sk) => { setPendingSection(sk); sectionFileRef.current.click(); }}
                      indent={28} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input type="file" ref={fileRef} style={{ display: "none" }} accept=".xlsx,.xls,.csv,.docx,.txt,.md,.pdf,.pptx"
        onChange={e => selected && handleFileUpload(e, selected.key, selected.item.id)} />
      <input type="file" ref={sectionFileRef} style={{ display: "none" }} accept=".xlsx,.xls,.csv,.docx,.txt,.md,.pdf,.pptx"
        onChange={e => pendingSection && handleSectionFileUpload(e, pendingSection)} />

      {/* ── DETAIL PANEL ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {uploading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12 }}>
            <div style={{ fontSize: 36 }}>⏳</div>
            <div style={{ fontWeight: 600, color: "#0d9488", fontSize: 15 }}>Parsing file…</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Extracting content from your document</div>
          </div>
        ) : selected ? (
          <DetailPanel
            selected={selected}
            noteInput={noteInput}
            setNoteInput={setNoteInput}
            onAddNote={addNote}
            onDelete={() => deleteEntry(selected.key, selected.item.id)}
            onUploadFile={() => fileRef.current.click()}
            activeFileTab={activeFileTab}
            setActiveFileTab={setActiveFileTab}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* ── MODAL ── */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 26, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: "#0f172a" }}>
              {modal.type === "profile" ? "🏭 New Company Profile" : `➕ Add to ${modal.label}`}
            </h2>
            {modal.type === "profile" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Company name *" style={inputStyle} />
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                  {CUSTOMER_TAGS.map(t => <option key={t}>{t}</option>)}
                </select>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description / overview..." rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title *" style={inputStyle} />
                <input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} placeholder="Tag (e.g. Active, Pricing, Strategy)" style={inputStyle} />
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Content / notes..." rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={() => modal.type === "profile" ? addProfile() : addEntry(modal.section)} style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Save</button>
              <button onClick={() => setModal(null)} style={{ background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section Items ────────────────────────────────────────────────
function SectionItems({ items, sectionKey, color, selected, onSelect, onAdd, onUpload, indent }) {
  return (
    <div>
      {items.map(item => (
        <button key={item.id} onClick={() => onSelect(item)} style={{ width: "100%", textAlign: "left", background: selected?.item?.id === item.id ? `${color}10` : "none", border: "none", borderLeft: selected?.item?.id === item.id ? `3px solid ${color}` : "3px solid transparent", padding: `8px 10px 8px ${indent}px`, cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: selected?.item?.id === item.id ? color : "#374151", marginBottom: 2 }}>{item.title || item.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {(item.tag || item.category) && <span style={{ fontSize: 10, background: "#f1f5f9", color: "#64748b", borderRadius: 3, padding: "1px 5px" }}>{item.tag || item.category}</span>}
            {item.files?.length > 0 && <span style={{ fontSize: 10, color: "#0d9488" }}>📎 {item.files.length}</span>}
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{item.date}</span>
          </div>
        </button>
      ))}
      <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9" }}>
        <button onClick={onAdd} style={{ flex: 1, background: "none", border: "none", padding: `7px 10px 7px ${indent}px`, cursor: "pointer", textAlign: "left", fontSize: 12, color, fontWeight: 600 }}>+ Add new</button>
        <button onClick={() => onUpload(sectionKey)} style={{ background: "none", border: "none", padding: "7px 12px", cursor: "pointer", fontSize: 11, color: "#94a3b8", fontWeight: 600 }} title="Upload file to this section">⬆ File</button>
      </div>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────
function DetailPanel({ selected, noteInput, setNoteInput, onAddNote, onDelete, onUploadFile, activeFileTab, setActiveFileTab }) {
  const { item, key } = selected;
  const [viewingFile, setViewingFile] = useState(null);

  useEffect(() => {
    if (activeFileTab?.fileId) {
      const f = item.files?.find(f => f.id === activeFileTab.fileId);
      setViewingFile(f || null);
    } else {
      setViewingFile(null);
    }
  }, [activeFileTab, item]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: "#0f172a", margin: 0 }}>{item.title || item.name}</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center" }}>
            {(item.tag || item.category) && <span style={{ fontSize: 12, background: "#f1f5f9", color: "#64748b", borderRadius: 6, padding: "3px 10px" }}>{item.tag || item.category}</span>}
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{item.date}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onUploadFile} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>⬆ Upload File</button>
          <button onClick={onDelete} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "#dc2626" }}>Delete</button>
        </div>
      </div>

      {/* Overview */}
      {(item.description || item.content) && !viewingFile && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Overview</div>
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{item.description || item.content}</p>
        </div>
      )}

      {/* File viewer */}
      {viewingFile && (
        <FileViewer file={viewingFile} activeSheet={activeFileTab?.sheetName} onSheetChange={s => setActiveFileTab(p => ({ ...p, sheetName: s }))} onClose={() => { setViewingFile(null); setActiveFileTab(null); }} />
      )}

      {/* Files list + Notes side by side */}
      {!viewingFile && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Files */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              📎 Files <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "1px 6px", marginLeft: 4 }}>{item.files?.length || 0}</span>
            </div>
            {!item.files?.length ? (
              <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>
                No files yet.<br />
                <span style={{ fontSize: 12 }}>Supports .xlsx, .xls, .csv, .docx, .txt</span>
              </div>
            ) : item.files.map(f => (
              <div key={f.id} onClick={() => { setViewingFile(f); setActiveFileTab({ fileId: f.id, sheetName: f.sheetNames?.[0] || null }); }}
                style={{ background: "#f8fafc", borderRadius: 8, padding: "9px 12px", marginBottom: 7, cursor: f.extractedText ? "pointer" : "default", border: "1px solid #e2e8f0", transition: "all 0.15s" }}
                onMouseEnter={e => f.extractedText && (e.currentTarget.style.borderColor = "#0d9488")}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{f.type === "excel" ? "📊" : f.type === "word" ? "📝" : f.type === "text" ? "📄" : "📎"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                      {f.size}
                      {f.type === "excel" && ` · ${f.rowCount} rows · ${f.sheetNames?.length} sheet(s)`}
                      {f.type === "word" && ` · ${f.wordCount?.toLocaleString()} words`}
                      {" · "}{f.date}
                    </div>
                  </div>
                  {f.extractedText && <span style={{ fontSize: 11, color: "#0d9488", fontWeight: 600 }}>View →</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              📝 Notes <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "1px 6px", marginLeft: 4 }}>{item.notes?.length || 0}</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === "Enter" && onAddNote()} placeholder="Add a note… (Enter to save)" style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 10px", fontSize: 13, outline: "none" }} />
              <button onClick={onAddNote} style={{ background: "#0d9488", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#fff", fontWeight: 700 }}>+</button>
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {!item.notes?.length ? (
                <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "12px 0" }}>No notes yet.</div>
              ) : item.notes.map(n => (
                <div key={n.id} style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 13, color: "#374151" }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{n.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── File Viewer ──────────────────────────────────────────────────
function FileViewer({ file, activeSheet, onSheetChange, onClose }) {
  if (file.type === "excel") {
    const sheet = file.sheets?.[activeSheet] || [];
    const headers = sheet[0] || [];
    const rows = sheet.slice(1);
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, background: "#f8fafc" }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{file.name}</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{rows.length} rows · {headers.length} columns</span>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#64748b" }}>✕ Close</button>
        </div>
        {/* Sheet tabs */}
        {file.sheetNames?.length > 1 && (
          <div style={{ display: "flex", gap: 2, padding: "6px 12px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", flexWrap: "wrap" }}>
            {file.sheetNames.map(s => (
              <button key={s} onClick={() => onSheetChange(s)} style={{ background: s === activeSheet ? "#0d9488" : "#fff", color: s === activeSheet ? "#fff" : "#374151", border: "1px solid #e2e8f0", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 12, fontWeight: s === activeSheet ? 700 : 400 }}>{s}</button>
            ))}
          </div>
        )}
        <div style={{ overflowX: "auto", maxHeight: 400 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", position: "sticky", top: 0 }}>
                {headers.map((h, i) => (
                  <th key={i} style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "left", fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{h || `Col ${i + 1}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  {headers.map((_, ci) => (
                    <td key={ci} style={{ border: "1px solid #f1f5f9", padding: "6px 10px", color: "#374151", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[ci] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (file.type === "word" || file.type === "text") {
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, background: "#f8fafc" }}>
          <span style={{ fontSize: 18 }}>{file.type === "word" ? "📝" : "📄"}</span>
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{file.name}</span>
          {file.wordCount && <span style={{ fontSize: 12, color: "#64748b" }}>{file.wordCount.toLocaleString()} words</span>}
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#64748b" }}>✕ Close</button>
        </div>
        <div style={{ padding: "16px 20px", maxHeight: 450, overflowY: "auto" }}>
          <pre style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "Georgia, serif", margin: 0 }}>{file.extractedText}</pre>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px", marginBottom: 16, textAlign: "center", color: "#94a3b8" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
      <div style={{ fontWeight: 600 }}>{file.name}</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>Preview not available for this file type ({file.ext})</div>
      <button onClick={onClose} style={{ marginTop: 12, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 12 }}>Close</button>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "#94a3b8" }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>📂</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#374151" }}>Select an item to view details</div>
      <div style={{ fontSize: 13, textAlign: "center", maxWidth: 320, lineHeight: 1.6, color: "#94a3b8" }}>
        Expand a section on the left, then click an entry.<br />
        Upload .xlsx, .xls, .csv, .docx, or .txt files directly into any entry.
      </div>
    </div>
  );
}

const inputStyle = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

