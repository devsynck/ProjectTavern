"use client";

import { useState, useEffect } from "react";
import { Bot, Image as ImageIcon, Sparkles, Wand2, Plus, Upload, FileJson, Copy, Check, Trash2, Zap } from "lucide-react";
import styles from "../app/settings/settings.module.css";
import { useNotification } from "@/components/NotificationProvider";
import { getSettings, saveSettings, syncSettings, DEFAULT_CONFIGURATION } from "@/utils/settings";

export default function VisualsSettings() {
  const { showNotification } = useNotification();
  const [comfyStatus, setComfyStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [settings, setSettings] = useState(DEFAULT_CONFIGURATION.settings);
  const [workflows, setWorkflows] = useState<{ id: string; name: string; json: string }[]>(DEFAULT_CONFIGURATION.workflows);
  const [defaultWorkflowId, setDefaultWorkflowId] = useState<string>("default-wf");
  const [editingWorkflow, setEditingWorkflow] = useState<{ id: string; name: string; json: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const loadedConfig = await syncSettings();
      setSettings(loadedConfig.settings);
      setWorkflows(loadedConfig.workflows);
      setDefaultWorkflowId(loadedConfig.defaultWorkflowId);
    };
    init();
  }, []);

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleToggle = (key: string) => {
    setSettings(prev => ({ ...prev, [key]: !(prev as any)[key] }));
  };

  const handleTestComfy = async () => {
    setComfyStatus("testing");
    try {
      const response = await fetch(`${settings.comfyUrl}/object_info`, { method: "GET" });
      if (response.ok) {
        setComfyStatus("success");
        showNotification("ComfyUI Connection Established", "success");
      } else {
        setComfyStatus("error");
        showNotification("Image Generation link failed", "error");
      }
    } catch (e) {
      setComfyStatus("error");
      showNotification("ComfyUI not responding", "error");
    }
  };
  const handleProcessFile = async (file: File) => {
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      showNotification("Please upload a valid JSON file.", "error");
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const newWf = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name.replace(".json", ""),
        json: JSON.stringify(json, null, 2)
      };
      setWorkflows(prev => [...prev, newWf]);
      showNotification(`Imported ${newWf.name} successfully.`, "success");
    } catch (e) {
      showNotification("Failed to parse JSON file.", "error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleProcessFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showNotification("Workflow JSON copied to clipboard.", "success");
  };


  const deleteWorkflow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkflows(prev => prev.filter(w => w.id !== id));
    if (defaultWorkflowId === id) setDefaultWorkflowId("");
  };

  const openAddModal = () => {
    setEditingWorkflow({ id: Math.random().toString(36).substr(2, 9), name: "", json: "{}" });
    setIsModalOpen(true);
  };

  const openEditModal = (wf: { id: string; name: string; json: string }) => {
    setEditingWorkflow({ ...wf });
    setIsModalOpen(true);
  };

  const saveWorkflowFromModal = () => {
    if (!editingWorkflow) return;
    setWorkflows(prev => {
      const exists = prev.find(w => w.id === editingWorkflow.id);
      if (exists) {
        return prev.map(w => w.id === editingWorkflow.id ? editingWorkflow : w);
      }
      return [...prev, editingWorkflow];
    });
    setIsModalOpen(false);
    setEditingWorkflow(null);
  };

  const handleSave = async () => {
    await saveSettings({ settings, workflows, defaultWorkflowId });
    showNotification("Visual settings updated successfully", "success");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <section className={styles.section} style={{ background: 'rgba(197, 160, 89, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className={styles.title} style={{ marginBottom: 0 }}>AI Image Generation</div>
          <div 
            onClick={() => handleToggle("enableImageGen")}
            style={{ 
              width: '60px', height: '32px', background: settings.enableImageGen ? 'var(--accent-gold)' : 'rgba(0,0,0,0.5)', 
              borderRadius: '16px', padding: '4px', cursor: 'pointer', position: 'relative', transition: 'all 0.3s ease',
              border: '1px solid var(--glass-border)', boxShadow: settings.enableImageGen ? '0 0 15px var(--accent-gold)' : 'none'
            }}
          >
            <div style={{ 
              width: '24px', height: '24px', background: settings.enableImageGen ? '#000' : 'var(--text-muted)', 
              borderRadius: '12px', transform: settings.enableImageGen ? 'translateX(28px)' : 'translateX(0)', 
              transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' 
            }} />
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          Enable or disable real-time AI image generation through the ComfyUI bridge.
        </p>

        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Auto-Generate Portrait</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Automatically generate a new visual for every AI response.
            </p>
          </div>
          <div 
            onClick={() => handleToggle("autoGenerateImages")}
            style={{ 
              width: '50px', height: '26px', background: settings.autoGenerateImages ? 'rgba(197, 160, 89, 0.2)' : 'rgba(0,0,0,0.5)', 
              borderRadius: '13px', padding: '3px', cursor: 'pointer', position: 'relative', transition: 'all 0.3s ease',
              border: '1px solid var(--glass-border)'
            }}
          >
            <div style={{ 
              width: '18px', height: '18px', background: settings.autoGenerateImages ? 'var(--accent-gold)' : 'var(--text-muted)', 
              borderRadius: '9px', transform: settings.autoGenerateImages ? 'translateX(24px)' : 'translateX(0)', 
              transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' 
            }} />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.title}>AI Image Generator (ComfyUI)</div>
        <div className={styles.field}>
          <label className={styles.label}>API Base URL</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              className={styles.input} 
              style={{ flex: 1 }}
              value={settings.comfyUrl}
              onChange={(e) => handleChange("comfyUrl", e.target.value)}
            />
            <button 
              className={styles.input} 
              style={{ background: 'rgba(197, 160, 89, 0.1)', cursor: 'pointer' }}
              onClick={handleTestComfy}
              disabled={comfyStatus === "testing"}
            >
              {comfyStatus === "testing" ? "Probing..." : "Test Link"}
            </button>
          </div>
        </div>
        
        {comfyStatus === "success" && (
          <div className={styles.statusBox} style={{ borderColor: '#4ade80' }}>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>✓ Image Generation Link Stable</span>
          </div>
        )}
        {comfyStatus === "error" && (
           <div className={styles.statusBox} style={{ borderColor: '#f87171' }}>
            <span style={{ color: '#f87171' }}>⚠ Failed to reach ComfyUI nodes.</span>
          </div>
        )}
      </section>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div className={styles.title} style={{ marginBottom: '4px' }}>Template Manager</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manage and import your ComfyUI workflow JSONs.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label className="btn-premium" style={{ height: '36px', padding: '0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={16} />
              <span>Import JSON</span>
              <input type="file" style={{ display: 'none' }} accept=".json" onChange={handleFileSelect} />
            </label>
            <button className="btn-premium" style={{ height: '36px', padding: '0 16px', background: 'var(--accent-gold)', color: '#000' }} onClick={openAddModal}>
              <Plus size={16} />
              <span>New Template</span>
            </button>
          </div>
        </div>
        
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '16px',
            padding: '20px',
            borderRadius: '8px',
            border: isDragging ? '2px dashed var(--accent-gold)' : '2px dashed transparent',
            background: isDragging ? 'rgba(197, 160, 89, 0.05)' : 'transparent',
            transition: 'all 0.2s ease',
            minHeight: workflows.length === 0 ? '200px' : 'auto'
          }}
        >
          {workflows.map(wf => (
            <div 
              key={wf.id} 
              className="parchment"
              onClick={() => openEditModal(wf)}
              style={{ 
                padding: '20px',
                display: 'flex',
                flexDirection: 'column', 
                alignItems: 'flex-start', 
                gap: '16px',
                cursor: 'pointer',
                border: defaultWorkflowId === wf.id ? '1px solid var(--accent-gold)' : '1px solid var(--glass-border)',
                background: defaultWorkflowId === wf.id ? 'rgba(197, 160, 89, 0.02)' : 'rgba(0,0,0,0.2)',
                position: 'relative',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: defaultWorkflowId === wf.id ? '0 10px 30px rgba(197, 160, 89, 0.1)' : 'none',
                overflow: 'hidden'
              }}
            >
              {defaultWorkflowId === wf.id && (
                <div style={{ 
                  position: 'absolute', top: 0, right: 0, 
                  background: 'var(--accent-gold)', color: '#000', 
                  padding: '2px 10px', fontSize: '0.6rem', 
                  fontWeight: 800, textTransform: 'uppercase',
                  borderBottomLeftRadius: '4px'
                }}>
                  Default
                </div>
              )}

              <div style={{ display: 'flex', width: '100%', gap: '16px', alignItems: 'center' }}>
                <div style={{ 
                  width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' 
                }}>
                  <FileJson size={20} color={defaultWorkflowId === wf.id ? 'var(--accent-gold)' : '#888'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: defaultWorkflowId === wf.id ? 'var(--accent-gold)' : '#fff' }}>{wf.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{JSON.parse(wf.json || "{}").length || Object.keys(JSON.parse(wf.json || "{}")).length} Nodes detected</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: 'auto' }}>
                <button 
                  className={styles.input} 
                  style={{ 
                    padding: '8px', flex: 1, textAlign: 'center', fontSize: '0.75rem',
                    background: defaultWorkflowId === wf.id ? 'rgba(197, 160, 89, 1)' : 'rgba(255,255,255,0.05)',
                    color: defaultWorkflowId === wf.id ? '#000' : '#fff',
                    border: 'none', fontWeight: 600
                  }}
                  onClick={(e) => { e.stopPropagation(); setDefaultWorkflowId(wf.id); }}
                >
                  {defaultWorkflowId === wf.id ? <Check size={14} style={{ margin: '0 auto' }} /> : "Set Default"}
                </button>
                <button 
                  className={styles.input} 
                  style={{ padding: '8px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: 'none' }}
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(wf.json, wf.id); }}
                  title="Copy JSON"
                >
                  {copiedId === wf.id ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                </button>
                <button 
                  className={styles.input} 
                  style={{ padding: '8px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248, 113, 113, 0.1)', border: 'none', color: '#f87171' }}
                  onClick={(e) => deleteWorkflow(wf.id, e)}
                  title="Delete Template"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          
          {workflows.length === 0 && (
            <div style={{ 
              gridColumn: '1/-1', 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '60px', color: 'var(--text-muted)'
            }}>
              <Zap size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No Templates Found</div>
              <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Drop a JSON file here or create a new template to start.</p>
            </div>
          )}
        </div>

      <button className="btn-premium" onClick={handleSave} style={{ alignSelf: 'flex-end' }}>
        Save Visual Settings
      </button>

      {/* Workflow Modal */}
      {isModalOpen && editingWorkflow && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px'
        }}>
          <div className="parchment" style={{
            width: '100%',
            maxWidth: '800px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            padding: '40px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 className="glow-gold" style={{ fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '2px' }}>Template Details</h2>
            
            <div className={styles.field}>
              <label className={styles.label}>Template Name</label>
              <input 
                className={styles.input}
                value={editingWorkflow.name}
                placeholder="e.g. Dreamy Watercolor"
                onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Workflow JSON (API Format)</label>
              <textarea 
                className={styles.input}
                style={{ minHeight: '300px', fontFamily: 'monospace', fontSize: '0.8rem' }}
                value={editingWorkflow.json}
                placeholder="Paste ComfyUI API JSON..."
                onChange={(e) => setEditingWorkflow({ ...editingWorkflow, json: e.target.value })}
              />
              <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '8px' }}>
                *CLIPTextEncode nodes will be dynamically populated with neutral/curated prompts.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <button className="btn-premium" style={{ flex: 1 }} onClick={saveWorkflowFromModal}>
                Save to Library
              </button>
              <button className={styles.input} style={{ flex: 1, cursor: 'pointer' }} onClick={() => setIsModalOpen(false)}>
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
