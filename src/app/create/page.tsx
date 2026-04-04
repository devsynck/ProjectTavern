"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { User, Sparkles, MessageSquare, BookOpen, Wand2, Plus, BrainCircuit, Download, Upload, Bot } from "lucide-react";
import styles from "./create.module.css";
import { useNotification } from "@/components/NotificationProvider";
import { tavernDB } from "@/utils/db";
import { getTavernSettings, getTavernArchive } from "@/utils/settings";

const MOCK_CHARACTERS = [
  { 
    id: "barnaby", 
    name: "Barnaby", 
    description: "The Jolly Barkeep. Knows everyone and everything.", 
    image: "/characters/barnaby.png", 
    personality: "Jolly, Wise, Secretive", 
    firstMessage: "Welcome, traveller! What'll it be?" 
  },
  { 
    id: "elara", 
    name: "Elara", 
    description: "A wandering scholar with a penchant for mysteries.", 
    image: "/characters/elara.png", 
    personality: "Curious, Analytical, Friendly", 
    firstMessage: "*She looks up from an old map.* Oh, fascinating timing." 
  },
];

function CreateCharacterForm() {
  const { showNotification } = useNotification();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isManifestingImage, setIsManifestingImage] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [character, setCharacter] = useState({
    id: "",
    name: "",
    description: "",
    personality: "",
    scenario: "",
    firstMessage: "",
    mes_example: "",
    alternate_greetings: [] as string[],
    tags: [] as string[],
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    creator: "Anonymous",
    character_version: "1.0",
    character_book: null,
    image: "/mystery.png"
  });

  const [manifestType, setManifestType] = useState<"character" | "traveler">("character");

  useEffect(() => {
    const loadArchetype = async () => {
      const archive = getTavernArchive();
      setSettings(archive);

      const id = searchParams.get("id");
      const typeParam = searchParams.get("type");
      const isTraveler = typeParam === "traveler";
      setManifestType(isTraveler ? "traveler" : "character");
      
      if (id) {
        setEditId(id);
        const bucket = isTraveler ? "travelers" : "library";
        const found = (await tavernDB.get<any>(bucket as any, id)) || 
                      (!isTraveler && MOCK_CHARACTERS.find((m: any) => m.id === id));
        
        if (found) {
          setCharacter(prev => ({
            ...prev,
            ...found,
            id: id,
            description: found.description || found.desc || "",
            firstMessage: found.firstMessage || found.first_mes || ""
          }));
        }
      }
    };
    loadArchetype();
  }, [searchParams]);

  const handleChange = (key: string, value: any) => {
    setCharacter(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    if (!character.name) {
      showNotification("A soul needs a name to be exported.", "error");
      return;
    }
    const TavernV2Card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        ...character,
        avatar: character.image,
        first_mes: character.firstMessage,
      }
    };
    const blob = new Blob([JSON.stringify(TavernV2Card, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${character.name.replace(/\s+/g, '_')}_v2.json`;
    a.click();
    showNotification("Exact Spec V2 scroll achieved.", "success");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const data = json.data || json;
        setCharacter(prev => ({
          ...prev,
          ...data,
          firstMessage: data.first_mes || data.firstMessage || "",
          image: data.avatar || "/mystery.png"
        }));
        showNotification("External soul manifested successfully.", "success");
      } catch (err) {
        showNotification("The imported scroll was corrupted.", "error");
      }
    };
    reader.readAsText(file);
  };

  const generateCharacter = async () => {
    if (!userPrompt.trim()) return;
    if (!settings?.settings?.apiUrl) {
      showNotification("API Connection not configured.", "error");
      return;
    }
    setIsGenerating(true);
    try {
      const isTravelerMode = manifestType === "traveler";
      const instruction = isTravelerMode 
        ? `Generate a Traveler Persona card (Player Card) based on: "${userPrompt}". 
           Respond ONLY with a JSON object. 
           Include: name, description (your physical & mental essence), personality, and creator_notes. 
           Structure as Tavern V2 Data.`
        : `Generate a Tavern V2 character card based on: "${userPrompt}". 
           Respond ONLY with a valid JSON object matching the chara_card_v2 spec.
           Structure:
           {
             "spec": "chara_card_v2",
             "spec_version": "2.0",
             "data": {
               "name": "...",
               "description": "...",
               "personality": "...",
               "scenario": "...",
               "first_mes": "...",
               "mes_example": "...",
               "alternate_greetings": [],
               "tags": [],
               "creator_notes": "...",
               "system_prompt": "...",
               "post_history_instructions": "...",
               "creator": "...",
               "character_version": "1.0"
             }
           }
           Ensure description uses Tavern {{char}}/{{user}} macros.`;

      const response = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: instruction }],
          settings: settings.settings,
          modelId: settings.settings.modelId || "glm-5",
          options: {
            temperature: 0.8,
            // For soul-creation, we might want a slightly different max_tokens if needed, but 800 is fine
            max_tokens: 1500 
          }
        })
      });
      
      if (response.ok) {
        // Our proxy returns choices[0].text instead of standard OpenAI structure
        const proxyData = await response.json();
        try {
          let contentRaw = proxyData.choices[0].text;
          contentRaw = contentRaw.replace(/```json/g, "").replace(/```/g, "").trim();
          
          const content = JSON.parse(contentRaw);
          const charData = content.data || content;
          
          const safeString = (val: any) => typeof val === 'string' ? val : (val ? JSON.stringify(val) : "");
          
          setCharacter(prev => ({
            ...prev,
            name: safeString(charData.name || prev.name),
            description: safeString(charData.description || charData.desc || prev.description),
            personality: safeString(charData.personality || prev.personality),
            scenario: safeString(charData.scenario || prev.scenario),
            firstMessage: safeString(charData.first_mes || charData.firstMessage || prev.firstMessage),
            mes_example: safeString(charData.mes_example || charData.example_dialogue || prev.mes_example),
            alternate_greetings: Array.isArray(charData.alternate_greetings) ? charData.alternate_greetings : prev.alternate_greetings,
            tags: Array.isArray(charData.tags) ? charData.tags : prev.tags,
            creator_notes: safeString(charData.creator_notes || charData.notes || prev.creator_notes),
            system_prompt: safeString(charData.system_prompt || prev.system_prompt),
            post_history_instructions: safeString(charData.post_history_instructions || prev.post_history_instructions),
          }));
          
          showNotification("A high-fidelity soul has manifested.", "success");
        } catch (parseErr) {
          showNotification("Structural instabilities detected in manifestation.", "error");
        }
      } else {
        const errorData = await response.json();
        showNotification(errorData.error?.message || "LLM Summoning failed.", "error");
      }
    } catch (e) {
      showNotification("Neural rift connection failed.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInvokeManifestation = async () => {
    if (isManifestingImage) return;
    if (!settings) {
      showNotification("Portal settings not configured.", "error"); return;
    }
    const { settings: s, workflows, defaultWorkflowId } = settings;
    if (!s.enableImageGen || !s.comfyUrl) {
      showNotification("Image Manifestation is not enabled in Visuals.", "error"); return;
    }
    const workflow = workflows.find((w: any) => w.id === defaultWorkflowId) || workflows[0];
    if (!workflow) {
      showNotification("No Manifestation Scroll (Workflow) found.", "error"); return;
    }

    setIsManifestingImage(true);
    try {
      // 1. Identity Blueprint Curation: Direct manifested handshake with the Neural Proxy
      const promptManifestRequest = {
        messages: [
          { role: "system", content: "You are a master director and visual manifestation architect for the Z-IMAGE-TURBO engine. Your task is to curate a HIGH-FIDELITY, long-form natural language image prompt (100-150 words) for a character's PERMANENT AVATAR. Describe them clearly based on their essence. Output ONLY the curated blueprint." },
          { role: "user", content: `Character Essence: ${character.description}\nPersonality: ${character.personality}\nName: ${character.name}` }
        ],
        settings: s,
        modelId: s.modelId || "glm-5",
        options: { max_tokens: 150 }
      };

      const promptResponse = await fetch(`/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(promptManifestRequest) });
      if (!promptResponse.ok) throw new Error("Neural Oracle failed to curate blueprint.");
      const promptData = await promptResponse.json();
      const curatedPrompt = promptData.choices?.[0]?.text?.trim()?.replace(/^Prompt: /i, "");
      
      // 3. Prompt ComfyUI
      const promptBase = `masterpiece, ultra highres, ${curatedPrompt}`;
      let workflowJson = JSON.parse(workflow.json);
      for (const key in workflowJson) {
        if (workflowJson[key].class_type === "CLIPTextEncode") {
          workflowJson[key].inputs.text = promptBase;
        }
      }

      const response = await fetch(`${s.comfyUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflowJson })
      });

      if (!response.ok) throw new Error("Manifestation link fractured.");
      const { prompt_id } = await response.json();

      // 4. Poll for results
      let imageUrl = "";
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const historyResp = await fetch(`${s.comfyUrl}/history/${prompt_id}`);
        const historyData = await historyResp.json();
        if (historyData[prompt_id]) {
          const outputs = historyData[prompt_id].outputs;
          for (const nodeKey in outputs) {
            if (outputs[nodeKey].images) {
              const img = outputs[nodeKey].images[0];
              imageUrl = `${s.comfyUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
              break;
            }
          }
          if (imageUrl) break;
        }
      }

      if (imageUrl) {
        const imgResp = await fetch(imageUrl);
        const blob = await imgResp.blob();
        const reader = new FileReader();
        const permanentUrl: string = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        setCharacter(prev => ({ ...prev, image: permanentUrl }));
        showNotification("Visual identity manifest successfully.", "success");
      }
    } catch (e) {
      showNotification("Visual manifestation failed.", "error");
    } finally {
      setIsManifestingImage(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!character.name) {
      showNotification("Souls need names.", "error"); return;
    }
    const isTravelerMode = manifestType === "traveler";
    const bucket = isTravelerMode ? "travelers" : "library";
    
    if (editId) {
      await tavernDB.set(bucket, editId, { ...character, id: editId, timestamp: Date.now() });
      showNotification(`${isTravelerMode ? "Traveler" : "Soul"} refined.`, "success");
    } else {
      const newId = Math.random().toString(36).substr(2, 9);
      const newEntry = { ...character, id: newId, timestamp: Date.now(), created_at: new Date().toISOString() };
      await tavernDB.set(bucket, newId, newEntry);
      showNotification(`${character.name} manifested.`, "success");
    }
    router.push("/library");
  };

  const isTravelerMode = manifestType === "traveler";

  return (
    <div className={`${styles.container} animate-entrance`}>
      <header className={styles.header}>
        <div>
          <h1 className="glow-gold" style={{ fontSize: '3rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase' }}>
            {isTravelerMode ? (editId ? "Traveler Refinement" : "Identity Architect") : (editId ? "Soul Refinement" : "Summoning Circle")}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {isTravelerMode ? "Architect the physical and mental essence of your persona." : (editId ? `Transmuting the essence of ${character.name}.` : "Manifest a new soul from a mere spark of imagination.")}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImport} />
          <button className={styles.input} onClick={() => fileInputRef.current?.click()}><Upload size={18} /><span>Import</span></button>
          <button className={styles.input} onClick={handleExport}><Download size={18} /><span>Export</span></button>
          <button className="btn-premium" onClick={handleSaveToLibrary}>
             <Sparkles size={18} />
             <span>{isTravelerMode ? (editId ? "Refine Traveler" : "Archive Identity") : (editId ? "Refine Soul" : "Archive Soul")}</span>
          </button>
        </div>
      </header>

      <section className={styles.section} style={{ background: 'rgba(197, 160, 89, 0.05)' }}>
        <div className={styles.sectionTitle}><BrainCircuit size={20} /><span>{isTravelerMode ? "Identity architect" : "Character Manifestation"}</span></div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <input className={styles.input} style={{ flex: 1 }} value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Describe the soul's spark..." />
          <button className="btn-premium" onClick={generateCharacter} disabled={isGenerating}>{isGenerating ? "Manifesting..." : "Summon LLM"}</button>
        </div>
      </section>

      <div className={styles.layout}>
        <div className={styles.mainContent}>
          <section className={styles.section}>
            <div className={styles.sectionTitle}><User size={20} /><span>Identity Architecture</span></div>
            <div className={styles.field}>
              <label className={styles.label}>Manifestation Type</label>
              <select 
                className={styles.input} 
                value={manifestType} 
                onChange={(e) => setManifestType(e.target.value as any)}
                required
              >
                <option value="character">Companion Soul (Character)</option>
                <option value="traveler">Traveler Persona (User)</option>
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>True Name</label><input className={styles.input} value={character.name} onChange={(e) => handleChange("name", e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>Physical Description</label><textarea className={styles.input} style={{ minHeight: '100px' }} value={character.description} onChange={(e) => handleChange("description", e.target.value)} /></div>
          </section>
          <section className={styles.section}>
            <div className={styles.sectionTitle}><BookOpen size={20} /><span>Personality & Echoes</span></div>
            <div className={styles.field}><label className={styles.label}>Personality Matrix</label><textarea className={styles.input} value={character.personality} onChange={(e) => handleChange("personality", e.target.value)} /></div>
            {!isTravelerMode && (
              <div className={styles.field}><label className={styles.label}>Dialogue Examples</label><textarea className={styles.input} style={{ minHeight: '150px', fontFamily: 'monospace' }} value={character.mes_example} onChange={(e) => handleChange("mes_example", e.target.value)} /></div>
            )}
          </section>
        </div>
        <div className={styles.sidebar}>
          {!isTravelerMode && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}><MessageSquare size={20} /><span>Utterances</span></div>
              <div className={styles.field}><label className={styles.label}>Main Greeting</label><textarea className={styles.input} value={character.firstMessage} onChange={(e) => handleChange("firstMessage", e.target.value)} /></div>
            </section>
          )}
          <section className={styles.section}>
            <div className={styles.sectionTitle}><BrainCircuit size={20} /><span>Neural Directives</span></div>
            <div className={styles.field}><label className={styles.label}>System Prompt Override</label><textarea className={styles.input} value={character.system_prompt} onChange={(e) => handleChange("system_prompt", e.target.value)} /></div>
          </section>
          <section className={styles.section} style={{ background: 'rgba(197, 160, 89, 0.05)' }}>
            <div className={styles.sectionTitle}><Wand2 size={20} /><span>Invoke Visual</span></div>
            <div style={{ position: 'relative', aspectRatio: '1/1', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px dashed var(--glass-border)', overflow: 'hidden' }}>
              <img src={character.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {isManifestingImage && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <Sparkles className="spin glow-gold" size={32} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Manifesting...</span>
                </div>
              )}
            </div>
            <button 
              className={styles.input} 
              style={{ width: '100%', color: 'var(--accent-gold)', cursor: 'pointer' }}
              onClick={handleInvokeManifestation}
              disabled={isManifestingImage}
            >
              {isManifestingImage ? "Channeling Nodes..." : "Invoke Node"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function CreateCharacterPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Channeling the Void...</div>}>
      <CreateCharacterForm />
    </Suspense>
  );
}
