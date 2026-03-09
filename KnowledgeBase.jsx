import { useState, useRef, useEffect } from "react";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";

const SECTION_CONFIG = {
  paycargo: {
    label: "PayCargo General",
    icon: "🏢",
    color: "#0d9488",
    description: "General knowledge about PayCargo, products, and processes",
  },
  vendors: {
    label: "Vendor Accounts",
    icon: "📦",
    color: "#7c3aed",
    description: "Customers who receive payments through PayCargo",
  },
  payers: {
    label: "Payer Accounts",
    icon: "💳",
    color: "#0284c7",
    description: "Customers who make payments through PayCargo to Vendors",
  },
  industry: {
    label: "Industry Knowledge",
    icon: "🌐",
    color: "#b45309",
    description: "Supply chain, logistics, and shipping industry insights",
  },
};

const STORAGE_KEYS = {
  entries: "kb-entries",
  profiles: "kb-profiles",
};

async function loadFromStorage(key) {
  try {
    const result = await window.storage.get(key);
    return result ? JSON.parse(result.value) : null;
  } catch {
    return null;
  }
}

async function saveToStorage(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

export default function KnowledgeBase() {
  const [activeSection, setActiveSection] = useState("paycargo");
  const [activeView, setActiveView] = useState("sections"); // sections | profiles
  const [entries, setEntries] = useState({
    paycargo: [],
    vendors: [],
    payers: [],
    industry: [],
  });
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: "", content: "", tags: "" });
  const [newProfile, setNewProfile] = useState({ name: "", category: "vendors", description: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef();
  const profileFileRef = useRef();

  useEffect(() => {
    (async () => {
      const savedEntries = await loadFromStorage(STORAGE_KEYS.entries);
      const savedProfiles = await loadFromStorage(STORAGE_KEYS.profiles);
      if (savedEntries) setEntries(savedEntries);
      if (savedProfiles) setProfiles(savedProfiles);
      setLoading(false);
    })();
  }, []);

  const saveEntries = async (updated) => {
    setEntries(updated);
    await saveToStorage(STORAGE_KEYS.entries, updated);
  };

  const saveProfiles = async (updated) => {
    setProfiles(updated);
    await saveToStorage(STORAGE_KEYS.profiles, updated);
  };

  const handleFileUpload = async (e, targetSection, profileId = null) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const preview = json
          .slice(0, 5)
          .map((r) => r.join(" | "))
          .join("\n");
        const entry = {
          id: Date.now(),
          title: file.name,
          content: `Spreadsheet uploaded: ${file.name}\n\nPreview (first 5 rows):\n${preview}\n\n[Full data: ${json.length} rows × ${json[0]?.length || 0} columns]`,
          tags: "excel,spreadsheet,data",
          type: "excel",
          date: new Date().toLocaleDateString(),
          rows: json.length,
          cols: json[0]?.length || 0,
          rawData: json,
        };
        if (profileId !== null) {
          const updated = profiles.map((p) =>
            p.id === profileId
              ? { ...p, files: [...(p.files || []), entry] }
              : p
          );
          await saveProfiles(updated);
          if (selectedProfile?.id === profileId) {
            setSelectedProfile(updated.find((p) => p.id === profileId));
          }
        } else {
          const updated = { ...entries, [targetSection]: [...entries[targetSection], entry] };
          await saveEntries(updated);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === "txt" || ext === "md") {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const entry = {
          id: Date.now(),
          title: file.name,
          content: evt.target.result,
          tags: "text,document",
          type: "text",
          date: new Date().toLocaleDateString(),
        };
        if (profileId !== null) {
          const updated = profiles.map((p) =>
            p.id === profileId ? { ...p, files: [...(p.files || []), entry] } : p
          );
          await saveProfiles(updated);
          if (selectedProfile?.id === profileId) setSelectedProfile(updated.find((p) => p.id === profileId));
        } else {
          const updated = { ...entries, [targetSection]: [...entries[targetSection], entry] };
          await saveEntries(updated);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const addManualEntry = async () => {
    if (!newEntry.title.trim()) return;
    const entry = {
      id: Date.now(),
      title: newEntry.title,
      content: newEntry.content,
      tags: newEntry.tags,
      type: "manual",
      date: new Date().toLocaleDateString(),
    };
    const updated = { ...entries, [activeSection]: [...entries[activeSection], entry] };
    await saveEntries(updated);
    setNewEntry({ title: "", content: "", tags: "" });
    setShowAddEntry(false);
  };

  const deleteEntry = async (section, id) => {
    const updated = { ...entries, [section]: entries[section].filter((e) => e.id !== id) };
    await saveEntries(updated);
  };

  const addProfile = async () => {
    if (!newProfile.name.trim()) return;
    const profile = {
      id: Date.now(),
      name: newProfile.name,
      category: newProfile.category,
      description: newProfile.description,
      files: [],
      notes: [],
      date: new Date().toLocaleDateString(),
    };
    const updated = [...profiles, profile];
    await saveProfiles(updated);
    setNewProfile({ name: "", category: "vendors", description: "" });
    setShowAddProfile(false);
  };

  const deleteProfile = async (id) => {
    const updated = profiles.filter((p) => p.id !== id);
    await saveProfiles(updated);
    if (selectedProfile?.id === id) setSelectedProfile(null);
  };

  const addProfileNote = async (profileId, note) => {
    if (!note.trim()) return;
    const updated = profiles.map((p) =>
      p.id === profileId
        ? { ...p, notes: [...(p.notes || []), { id: Date.now(), text: note, date: new Date().toLocaleDateString() }] }
        : p
    );
    await saveProfiles(updated);
    setSelectedProfile(updated.find((p) => p.id === profileId));
  };

  const filteredEntries = entries[activeSection]?.filter(
    (e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.tags?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProfiles = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalEntries = Object.values(entries).reduce((a, b) => a + b.length, 0);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8fafc", fontFamily: "Georgia, serif", color: "#0d9488", fontSize: 18 }}>
        Loading Knowledge Base...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: "#f0f4f8", minHeight: "100vh", color: "#1e293b" }}>
      {/* Header */}
      <div style={{ background: "#0f172a", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #0d9488" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "#0d9488", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📚</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>Knowledge Base</div>
            <div style={{ color: "#94a3b8", fontSize: 11 }}>AI Mail Command · PayCargo</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ background: "#1e293b", color: "#94a3b8", borderRadius: 20, padding: "4px 12px", fontSize: 12 }}>{totalEntries} entries</span>
          <span style={{ background: "#1e293b", color: "#94a3b8", borderRadius: 20, padding: "4px 12px", fontSize: 12 }}>{profiles.length} profiles</span>
        </div>
      </div>

      {/* Nav */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px", display: "flex", gap: 0 }}>
        {[
          { id: "sections", label: "📂 Knowledge Sections" },
          { id: "profiles", label: "🏭 Company Profiles" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveView(tab.id); setSearchQuery(""); setSelectedProfile(null); }}
            style={{
              background: "none", border: "none", padding: "14px 20px", cursor: "pointer",
              fontSize: 13, fontWeight: activeView === tab.id ? 700 : 500,
              color: activeView === tab.id ? "#0d9488" : "#64748b",
              borderBottom: activeView === tab.id ? "2px solid #0d9488" : "2px solid transparent",
              marginBottom: -1, transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 110px)" }}>
        {/* ── SECTIONS VIEW ── */}
        {activeView === "sections" && (
          <>
            {/* Sidebar */}
            <div style={{ width: 220, background: "#fff", borderRight: "1px solid #e2e8f0", padding: "16px 0", flexShrink: 0, overflowY: "auto" }}>
              {Object.entries(SECTION_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => { setActiveSection(key); setShowAddEntry(false); }}
                  style={{
                    width: "100%", textAlign: "left", background: activeSection === key ? `${cfg.color}15` : "none",
                    border: "none", borderLeft: activeSection === key ? `3px solid ${cfg.color}` : "3px solid transparent",
                    padding: "12px 16px", cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{cfg.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: activeSection === key ? cfg.color : "#374151" }}>{cfg.label}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{entries[key]?.length || 0} entries</div>
                </button>
              ))}
            </div>

            {/* Main content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Section header */}
              <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{SECTION_CONFIG[activeSection].icon}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: SECTION_CONFIG[activeSection].color }}>{SECTION_CONFIG[activeSection].label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{SECTION_CONFIG[activeSection].description}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search entries..."
                    style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", fontSize: 13, width: 180, outline: "none" }}
                  />
                  <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".xlsx,.xls,.csv,.txt,.md" onChange={(e) => handleFileUpload(e, activeSection)} />
                  <button onClick={() => fileInputRef.current.click()} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "#374151", fontWeight: 600 }}>
                    ⬆ Upload File
                  </button>
                  <button onClick={() => setShowAddEntry(!showAddEntry)} style={{ background: "#0d9488", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "#fff", fontWeight: 600 }}>
                    + Add Entry
                  </button>
                </div>
              </div>

              {/* Add entry form */}
              {showAddEntry && (
                <div style={{ padding: "16px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 600 }}>
                    <input
                      value={newEntry.title}
                      onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                      placeholder="Entry title *"
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none" }}
                    />
                    <textarea
                      value={newEntry.content}
                      onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                      placeholder="Content / knowledge..."
                      rows={4}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                    />
                    <input
                      value={newEntry.tags}
                      onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                      placeholder="Tags (comma separated)"
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={addManualEntry} style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Save Entry</button>
                      <button onClick={() => setShowAddEntry(false)} style={{ background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Entries list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                {filteredEntries?.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No entries yet</div>
                    <div style={{ fontSize: 13 }}>Upload a file or add an entry manually to get started</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filteredEntries.map((entry) => (
                      <div key={entry.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", position: "relative" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 16 }}>{entry.type === "excel" ? "📊" : entry.type === "text" ? "📄" : "✏️"}</span>
                              <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{entry.title}</span>
                              {entry.type === "excel" && (
                                <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, borderRadius: 4, padding: "2px 6px" }}>{entry.rows} rows × {entry.cols} cols</span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 100, overflow: "hidden" }}>{entry.content}</div>
                            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                              {entry.tags?.split(",").filter(Boolean).map((t) => (
                                <span key={t} style={{ background: "#f1f5f9", color: "#64748b", fontSize: 11, borderRadius: 4, padding: "2px 8px" }}>{t.trim()}</span>
                              ))}
                              <span style={{ color: "#cbd5e1", fontSize: 11, marginLeft: "auto" }}>{entry.date}</span>
                            </div>
                          </div>
                          <button onClick={() => deleteEntry(activeSection, entry.id)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 16, padding: 4, flexShrink: 0 }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── PROFILES VIEW ── */}
        {activeView === "profiles" && (
          <>
            {/* Profiles sidebar */}
            <div style={{ width: 260, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search profiles..."
                  style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none" }}
                />
                <button onClick={() => setShowAddProfile(true)} style={{ background: "#0d9488", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 16 }}>+</button>
              </div>

              {/* Category filters */}
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Object.entries({ all: "All", vendors: "Vendors", payers: "Payers", industry: "Industry" }).map(([k, v]) => (
                  <button key={k} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, padding: "3px 10px", fontSize: 11, cursor: "pointer", color: "#64748b" }}>{v}</button>
                ))}
              </div>

              <div style={{ overflowY: "auto", flex: 1 }}>
                {filteredProfiles.length === 0 ? (
                  <div style={{ padding: "30px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No profiles yet.<br />Click + to create one.</div>
                ) : (
                  filteredProfiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProfile(p)}
                      style={{
                        width: "100%", textAlign: "left", background: selectedProfile?.id === p.id ? "#f0fdfa" : "none",
                        border: "none", borderLeft: selectedProfile?.id === p.id ? "3px solid #0d9488" : "3px solid transparent",
                        padding: "12px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: selectedProfile?.id === p.id ? "#0d9488" : "#1e293b" }}>{p.name}</span>
                        <span style={{ fontSize: 10, background: p.category === "vendors" ? "#ede9fe" : p.category === "payers" ? "#dbeafe" : "#fef3c7", color: p.category === "vendors" ? "#7c3aed" : p.category === "payers" ? "#0284c7" : "#b45309", borderRadius: 4, padding: "2px 6px" }}>{p.category}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{p.description?.substring(0, 50)}{p.description?.length > 50 ? "..." : ""}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{(p.files?.length || 0)} files · {(p.notes?.length || 0)} notes</div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Profile detail */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {showAddProfile ? (
                <div style={{ padding: 32, maxWidth: 500 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#0f172a" }}>Create Company Profile</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <input
                      value={newProfile.name}
                      onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                      placeholder="Company name (e.g. UPS, DHL, DSV) *"
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }}
                    />
                    <select
                      value={newProfile.category}
                      onChange={(e) => setNewProfile({ ...newProfile, category: e.target.value })}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", background: "#fff" }}
                    >
                      <option value="vendors">Vendor Account</option>
                      <option value="payers">Payer Account</option>
                      <option value="industry">Industry</option>
                    </select>
                    <textarea
                      value={newProfile.description}
                      onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                      placeholder="Description / overview..."
                      rows={4}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={addProfile} style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Create Profile</button>
                      <button onClick={() => setShowAddProfile(false)} style={{ background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : !selectedProfile ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "#94a3b8" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🏭</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Select a Company Profile</div>
                  <div style={{ fontSize: 13 }}>Or click + to create a new one</div>
                  <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 400 }}>
                    {["UPS", "DHL", "DSV", "DP World", "FedEx", "Maersk"].map((name) => (
                      <button
                        key={name}
                        onClick={() => { setNewProfile({ name, category: "vendors", description: "" }); setShowAddProfile(true); }}
                        style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "#64748b" }}
                      >
                        + {name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ProfileDetail
                  profile={selectedProfile}
                  profiles={profiles}
                  onDelete={() => deleteProfile(selectedProfile.id)}
                  onAddNote={(note) => addProfileNote(selectedProfile.id, note)}
                  onFileUpload={(e) => handleFileUpload(e, null, selectedProfile.id)}
                  profileFileRef={profileFileRef}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProfileDetail({ profile, onDelete, onAddNote, onFileUpload, profileFileRef }) {
  const [note, setNote] = useState("");
  const cfg = SECTION_CONFIG[profile.category] || SECTION_CONFIG.vendors;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, background: `${cfg.color}20`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{cfg.icon}</div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>{profile.name}</h1>
              <span style={{ fontSize: 12, background: `${cfg.color}20`, color: cfg.color, borderRadius: 4, padding: "2px 8px" }}>{cfg.label}</span>
            </div>
          </div>
          {profile.description && <p style={{ fontSize: 14, color: "#475569", marginTop: 10, maxWidth: 600, lineHeight: 1.6 }}>{profile.description}</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="file" ref={profileFileRef} style={{ display: "none" }} accept=".xlsx,.xls,.csv,.txt,.md" onChange={onFileUpload} />
          <button onClick={() => profileFileRef.current.click()} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>⬆ Upload File</button>
          <button onClick={onDelete} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: "#dc2626" }}>Delete</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Files */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>📎 Files & Documents <span style={{ background: "#f1f5f9", borderRadius: 10, padding: "1px 8px", fontSize: 12, fontWeight: 500 }}>{profile.files?.length || 0}</span></h3>
          {!profile.files?.length ? (
            <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No files yet. Upload Excel, CSV, or text files.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {profile.files.map((f) => (
                <div key={f.id} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{f.type === "excel" ? "📊" : "📄"}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{f.title}</span>
                    {f.type === "excel" && <span style={{ fontSize: 11, color: "#16a34a", background: "#dcfce7", borderRadius: 4, padding: "1px 6px" }}>{f.rows}r × {f.cols}c</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{f.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>📝 Notes <span style={{ background: "#f1f5f9", borderRadius: 10, padding: "1px 8px", fontSize: 12, fontWeight: 500 }}>{profile.notes?.length || 0}</span></h3>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { onAddNote(note); setNote(""); } }}
              placeholder="Add a note..."
              style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none" }}
            />
            <button onClick={() => { onAddNote(note); setNote(""); }} style={{ background: "#0d9488", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "#fff", fontWeight: 700 }}>+</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
            {!profile.notes?.length ? (
              <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "12px 0" }}>No notes yet.</div>
            ) : (
              profile.notes.map((n) => (
                <div key={n.id} style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 13, color: "#374151" }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{n.date}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
