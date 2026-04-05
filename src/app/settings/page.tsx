"use client";

import { useState, useEffect } from "react";
import { Bot, Image as ImageIcon, Volume2, Save, Sliders, ShieldCheck, BrainCircuit } from "lucide-react";
import styles from "./settings.module.css";
import { useNotification } from "@/components/NotificationProvider";
import { getTavernSettings, saveSettings, syncSettings, DEFAULT_CONFIGURATION } from "@/utils/settings";
import VisualsSettings from "@/components/VisualsSettings";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

type SettingsTab = "Inference" | "Visuals" | "Speech" | "General";

export default function SettingsPage() {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<SettingsTab>("Inference");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [activeModels, setActiveModels] = useState<string[]>([]);
  const [settings, setSettings] = useState(DEFAULT_CONFIGURATION.settings);

  // Persistence Logic
  useEffect(() => {
    const init = async () => {
      const loadedConfig = await syncSettings();
      setSettings(loadedConfig.settings);
    };
    init();
  }, []);

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    try {
      // Connection Discovery: Probe the API through the server-side proxy
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings })
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.data.map((m: any) => m.id || m.name);
        setActiveModels(models);
        
        // Auto-Discovery: Apply the first model ID into the Target field
        if (models.length > 0) {
          setSettings(prev => ({ ...prev, modelId: models[0] }));
        }

        setTestStatus("success");
        showNotification("API Connection Established", "success");
      } else {
        const errorData = await response.json();
        setTestStatus("error");
        showNotification(errorData.error || "Failed to reach AI Provider.", "error");
      }
    } catch (e) {
      setTestStatus("error");
      showNotification("Connection refused by API Gateway.", "error");
    }
  };

  const handleSave = async () => {
    await saveSettings({ settings });
    showNotification("Settings updated successfully", "success");
  };


  const tabs: { id: SettingsTab; icon: any }[] = [
    { id: "Inference", icon: Bot },
    { id: "Visuals", icon: ImageIcon },
    { id: "Speech", icon: Volume2 },
    { id: "General", icon: Sliders },
  ];

  return (
    <div className={`${styles.container} animate-entrance`}>
      <header className={styles.settingsHeader}>
        <div>
          <h1 className="glow-gold" style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', letterSpacing: '2px' }}>
            System Settings
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            System Configuration & Engine Setup
          </p>
        </div>
        <button className="btn-premium" onClick={handleSave}>
          <Save size={18} style={{ marginRight: '10px' }} />
          Save Settings
        </button>
      </header>

      <div className={styles.tabbedLayout}>
        <div className={styles.tabSidebar}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`${styles.tabLink} ${activeTab === tab.id ? styles.activeTab : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.id}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.tabContent}>
          {activeTab === "Inference" && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                <BrainCircuit size={20} />
                <div className={styles.title}>OpenAI Compatible Server</div>
              </div>
              
              <div className={styles.field}>
                <label className={styles.label}>AI Provider</label>
                <select 
                  className={styles.input} 
                  value={settings.inferenceProvider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    let url = settings.apiUrl;
                    let model = settings.modelId;
                    if (provider === "Z.ai (General)") {
                      url = "https://api.z.ai/api/paas/v4";
                      model = "glm-5";
                    } else if (provider === "OpenRouter") {
                      url = "https://openrouter.ai/api/v1";
                      model = "google/gemini-2.0-flash-lite-001";
                    } else if (provider === "OpenAI") {
                      url = "http://127.0.0.1:8080";
                    }
                    setSettings(prev => ({ ...prev, inferenceProvider: provider, apiUrl: url, modelId: model }));
                  }}
                >
                  <option value="OpenAI">OpenAI Compatible Server (Llama.cpp, Ollama)</option>
                  <option value="Z.ai (General)">Z.ai (Prepaid / General API)</option>
                  <option value="OpenRouter">OpenRouter (Universal Aggregator)</option>
                  <option value="Other">Custom API Gateway</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Server API Endpoint (Base URL)</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    className={styles.input} 
                    style={{ flex: 1 }}
                    placeholder={settings.inferenceProvider?.includes("Z.ai") ? "https://api.z.ai/api/paas/v4" : "http://127.0.0.1:8080"}
                    value={settings.apiUrl}
                    onChange={(e) => handleChange("apiUrl", e.target.value)}
                  />
                  <button 
                    className={styles.input} 
                    style={{ background: 'rgba(197, 160, 89, 0.1)', cursor: 'pointer' }}
                    onClick={handleTestConnection}
                    disabled={testStatus === "testing"}
                  >
                    {testStatus === "testing" ? "Probing..." : "Test Link"}
                  </button>
                </div>
                <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '4px' }}>
                  {settings.inferenceProvider === "OpenRouter" ? "*OpenRouter uses the universal /api/v1 endpoint." :
                   "*Standard OpenAI-Compatible API Providers use /v1 chat endpoints."}
                </p>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>API Key (Bearer Token)</label>
                <input 
                  className={styles.input} 
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => handleChange("apiKey", e.target.value)}
                  placeholder="Optional authorization token..."
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>AI Model (Model ID)</label>
                <input 
                  className={styles.input} 
                  value={settings.modelId}
                  onChange={(e) => handleChange("modelId", e.target.value)}
                  placeholder="e.g. glm-5, gpt-4, etc."
                  list="model-list"
                />
                <datalist id="model-list">
                  {activeModels.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              {testStatus === "success" && (
                <div className={styles.statusBox} style={{ borderColor: '#4ade80' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '8px' }}>✓ Connection Stable</div>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.5 }}>Active Models:</div>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {activeModels.map(m => (
                        <li key={m} style={{ color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Bot size={14} /> {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {testStatus === "error" && (
                <div className={styles.statusBox} style={{ borderColor: '#f87171' }}>
                  <span style={{ color: '#f87171' }}>⚠ Connection Failed. Ensure OpenAI Compatible Server is active.</span>
                </div>
              )}
            </section>
          )}

          {activeTab === "Visuals" && (
            <VisualsSettings />
          )}

          {activeTab === "Speech" && (
            <section className={styles.section}>
              <div className={styles.title}>Voice Provider (TTS)</div>
              <div className={styles.field}>
                <label className={styles.label}>Voice Provider</label>
                <select 
                  className={styles.input} 
                  value={settings.ttsProvider}
                  onChange={(e) => handleChange("ttsProvider", e.target.value)}
                >
                  <option value="WebSpeech">In-Browser (WebSpeech)</option>
                  <option value="Kokoro">Kokoro-82M (OpenAI-Compatible)</option>
                  <option value="CosyVoice">CosyVoice (Neural-Sync)</option>
                  <option value="XTTSv2">XTTSv2 (Multilingual-Echo)</option>
                  <option value="index-tts">index-tts (Industrial)</option>
                  <option value="ElevenLabs">ElevenLabs (Atmospheric)</option>
                </select>
              </div>

              {["Kokoro", "CosyVoice", "XTTSv2", "index-tts"].includes(settings.ttsProvider) && (
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className={styles.field}>
                    <label className={styles.label}>{settings.ttsProvider} API URL</label>
                    <input 
                      className={styles.input} 
                      value={settings.kokoroUrl}
                      onChange={(e) => handleChange("kokoroUrl", e.target.value)}
                      placeholder="http://localhost:8880/v1"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Voice Identity (Reference ID)</label>
                    <input 
                      className={styles.input} 
                      value={settings.kokoroVoice}
                      onChange={(e) => handleChange("kokoroVoice", e.target.value)}
                      placeholder="af_sky / your_voice_id"
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === "General" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <section className={styles.section}>
                <div className={styles.title}>User Profile (You)</div>
                <div className={styles.field}>
                  <label className={styles.label}>User Name {"{{user}}"}</label>
                  <input 
                    className={styles.input} 
                    value={settings.userName}
                    onChange={(e) => handleChange("userName", e.target.value)}
                    placeholder="Your primary name..."
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Avatar URI (User Avatar)</label>
                  <input 
                    className={styles.input} 
                    value={settings.userImage}
                    onChange={(e) => handleChange("userImage", e.target.value)}
                    placeholder="/path/to/your/avatar.png"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>User Description (Bio)</label>
                  <textarea 
                    className={styles.input} 
                    style={{ minHeight: '120px' }}
                    value={settings.userPersona}
                    onChange={(e) => handleChange("userPersona", e.target.value)}
                    placeholder="Describe your essence, history, or demeanor..."
                  />
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.title}>Chat Styling</div>
                <div className={styles.field}>
                  <label className={styles.label}>Narrator Style</label>
                  <select className={styles.input}>
                    <option>Italic Amber (Default)</option>
                    <option>Classic Parchment</option>
                  </select>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
