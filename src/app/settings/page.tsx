"use client";

import { useState, useEffect } from "react";
import { BrainCircuit, Image as ImageIcon, Sparkles, Wand2, Plus, Volume2, Save, Trash2, Bot, Loader2, Upload, Sliders, ShieldCheck, ExternalLink } from "lucide-react";
import styles from "./settings.module.css";
import { useNotification } from "@/components/NotificationProvider";
import { getTavernSettings, saveSettings, syncSettings, DEFAULT_CONFIGURATION } from "@/utils/settings";
import VisualsSettings from "@/components/VisualsSettings";
import Link from "next/link";

type SettingsTab = "Inference" | "Visuals" | "Speech" | "General";

export default function SettingsPage() {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<SettingsTab>("Inference");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [activeModels, setActiveModels] = useState<string[]>([]);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
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

  const handleImproveBio = async () => {
    if (!settings.userPersona.trim()) return;
    setIsGeneratingBio(true);
    try {
      const response = await fetch(`/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a master character architect. Your task is to rewrite the provided user bio to be more descriptive, evocative, and suitable for a high-fidelity roleplay environment. Keep it around 50-80 words. Focus on essence, demeanor, and physical presence. Output ONLY the rewritten bio." },
            { role: "user", content: `Current Bio: ${settings.userPersona}` }
          ],
          settings,
          modelId: settings.modelId || "glm-5",
          options: { temperature: 0.8, max_tokens: 300 }
        })
      });
      if (response.ok) {
        const data = await response.json();
        const refined = data.choices[0].text.trim();
        handleChange("userPersona", refined);
        showNotification("User bio has been refined by AI.", "success");
      }
    } catch (e) {
      showNotification("AI Refinement failed.", "error");
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const handleGenerateUserAvatar = async () => {
    const config = await syncSettings();
    const s = config.settings;
    if (!s.enableImageGen || !s.comfyUrl) {
      showNotification("Image Gen is disabled in Visuals.", "error"); return;
    }
    const workflow = config.workflows.find((w: any) => w.id === config.defaultWorkflowId) || config.workflows[0];
    if (!workflow) {
      showNotification("No workflow template found.", "error"); return;
    }

    setIsGeneratingAvatar(true);
    try {
      const promptResp = await fetch(`/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Create a detailed, high-quality visual description (100 words) for a user's profile icon based on their description. Focus on lighting, textures, and neutral backdrop. Output ONLY the prompt." },
            { role: "user", content: `User Description: ${settings.userPersona}\nName: ${settings.userName}` }
          ],
          settings,
          modelId: settings.modelId || "glm-5",
          options: { max_tokens: 200 }
        })
      });
      const pData = await promptResp.json();
      const curatedPrompt = pData.choices[0].text.trim();
      
      let workflowJson = JSON.parse(workflow.json);
      for (const key in workflowJson) {
        if (workflowJson[key].class_type === "CLIPTextEncode") {
          workflowJson[key].inputs.text = `masterpiece, ultra highres, ${curatedPrompt}`;
        }
      }

      const comfyResp = await fetch(`/api/comfy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: s.comfyUrl, payload: { prompt: workflowJson } })
      });
      const { prompt_id } = await comfyResp.json();

      let imageUrl = "";
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const hResp = await fetch(`/api/comfy?url=${encodeURIComponent(s.comfyUrl)}&path=/history/${prompt_id}`);
        const hData = await hResp.json();
        if (hData[prompt_id]) {
          const outputs = hData[prompt_id].outputs;
          for (const nk in outputs) { if (outputs[nk].images) { const img = outputs[nk].images[0]; imageUrl = `${s.comfyUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`; break; } }
          if (imageUrl) break;
        }
      }

      if (imageUrl) {
        const iR = await fetch(imageUrl); const blob = await iR.blob();
        const reader = new FileReader();
        const permanentUrl: string = await new Promise((res) => {
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(blob);
        });
        handleChange("userImage", permanentUrl);
        showNotification("AI Avatar generated and mapped.", "success");
      }
    } catch (e) {
      showNotification("AI Avatar generation failed.", "error");
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleChange("userImage", reader.result as string);
      showNotification("Identity portrait updated.", "success");
    };
    reader.readAsDataURL(file);
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
                    const nextProvider = e.target.value;
                    const prevProvider = settings.inferenceProvider;
                    
                    // 1. Save Current to Config Registry
                    const updatedConfigs = {
                      ...settings.providerConfigs,
                      [prevProvider]: {
                        apiUrl: settings.apiUrl,
                        apiKey: settings.apiKey,
                        modelId: settings.modelId
                      }
                    };

                    // 2. Load Next from Config Registry with global defaults as fallback
                    const defaultProviderConfigs = DEFAULT_CONFIGURATION.settings.providerConfigs;
                    const nextConfig = updatedConfigs[nextProvider] || defaultProviderConfigs[nextProvider] || { apiUrl: "", apiKey: "", modelId: "" };
                    
                    // If the config existed but had an empty URL, still provide the default if available
                    if (!nextConfig.apiUrl && defaultProviderConfigs[nextProvider]) {
                      nextConfig.apiUrl = defaultProviderConfigs[nextProvider].apiUrl;
                    }
                    if (!nextConfig.modelId && defaultProviderConfigs[nextProvider]) {
                      nextConfig.modelId = defaultProviderConfigs[nextProvider].modelId;
                    }

                    setSettings(prev => ({ 
                      ...prev, 
                      inferenceProvider: nextProvider,
                      apiUrl: nextConfig.apiUrl,
                      apiKey: nextConfig.apiKey,
                      modelId: nextConfig.modelId,
                      providerConfigs: updatedConfigs
                    }));
                  }}
                >
                  <optgroup label="Local Inference Servers">
                    <option value="Ollama">Ollama</option>
                    <option value="Llama.cpp">Llama.cpp</option>
                    <option value="LM Studio">LM Studio</option>
                  </optgroup>
                  <optgroup label="Cloud & Aggregators">
                    <option value="OpenRouter">OpenRouter</option>
                    <option value="Z.AI">Z.AI</option>
                    <option value="Groq">Groq</option>
                    <option value="Together">Together AI</option>
                    <option value="Mistral">Mistral AI</option>
                    <option value="Gemini">Google Gemini</option>
                    <option value="Custom">OpenAI Compatible Server</option>
                  </optgroup>
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
              <section className={styles.section} style={{ background: 'rgba(197, 160, 89, 0.05)' }}>
                <div className={styles.title}>User Identity (You)</div>
                <div style={{ display: 'flex', gap: '32px' }}>
                  <div style={{ flex: '0 0 160px' }}>
                    <div style={{ 
                      position: 'relative', width: '160px', height: '160px', 
                      background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden',
                      border: '1px solid var(--glass-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      marginBottom: '12px'
                    }}>
                      <img src={settings.userImage} alt="Your Portrait" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {isGeneratingAvatar && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <Loader2 className="spin glow-gold" size={24} />
                          <span style={{ fontSize: '0.6rem', color: 'var(--accent-gold)' }}>Visualizing...</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <button className="btn-premium" style={{ width: '100%', height: '32px', fontSize: '0.75rem' }} onClick={handleGenerateUserAvatar} disabled={isGeneratingAvatar}>
                         <Sparkles size={14} /> <span>AI Generate</span>
                       </button>
                       <label className={styles.input} style={{ width: '100%', height: '32px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', padding: '0', cursor: 'pointer', background: 'rgba(255,255,255,0.05)' }}>
                         <Upload size={14} /> <span>Upload</span>
                         <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleAvatarUpload} />
                       </label>
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className={styles.field}>
                      <label className={styles.label}>User Name {"{{user}}"}</label>
                      <input 
                        className={styles.input} 
                        value={settings.userName}
                        onChange={(e) => handleChange("userName", e.target.value)}
                        placeholder="Your primary identity..."
                      />
                    </div>
                    <div className={styles.field}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className={styles.label} style={{ marginBottom: 0 }}>Identity Bio (Essence)</label>
                        <button 
                          onClick={handleImproveBio} 
                          disabled={isGeneratingBio}
                          style={{ 
                            background: 'rgba(197, 160, 89, 0.1)', border: '1px solid var(--glass-border)',
                            color: 'var(--accent-gold)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <Sparkles size={12} className={isGeneratingBio ? "spin" : ""} />
                          <span>{isGeneratingBio ? "Refining..." : "AI Improve Bio"}</span>
                        </button>
                      </div>
                      <textarea 
                        className={styles.input} 
                        style={{ minHeight: '136px' }}
                        value={settings.userPersona}
                        onChange={(e) => handleChange("userPersona", e.target.value)}
                        placeholder="Define your traits for the AI to acknowledge..."
                      />
                    </div>
                  </div>
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
