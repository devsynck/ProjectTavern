"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus, Download, Edit2, Trash2, Sparkles, Image as ImageIcon, Wand2, Volume2, Bot } from "lucide-react";
import styles from "./library.module.css";
import { useNotification } from "@/components/NotificationProvider";
import { parseCharacterPNG, extractCharacterData, fileToDataURL } from "@/utils/tavernParser";
import EditCharModal from "@/components/EditCharModal";
import ConfirmModal from "@/components/ConfirmModal";
import { tavernDB } from "@/utils/db";
import { getTavernSettings, saveTavernSettings, syncTavernArchive } from "@/utils/settings";

// Cleaner utility to strip raw Tavern tags from snippets
const cleanSnippet = (text: string) => {
  if (!text) return "";
  return text
    .replace(/\{\{char\}\}\s*=?\s*/g, "")
    .replace(/\[Name\([^)]+\)\s*Species\([^)]+\)\]/g, "")
    .replace(/Name\([^)]+\)\s*/g, "")
    .replace(/Species\([^)]+\)\s*/g, "")
    .replace(/Sex\([^)]+\)\s*/g, "")
    .replace(/Age\(\d+\)\s*/g, "")
    .replace(/Occupation\([^)]+\)\s*/g, "")
    .replace(/Appearance\([^)]+\)\s*/g, "")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const MOCK_CHARACTERS = [
  { 
    id: "barnaby", 
    name: "Barnaby", 
    desc: "The Jolly Barkeep. Knows everyone and everything.", 
    image: "/characters/barnaby.png", 
    personality: "Jolly, Wise, Secretive", 
    first_mes: "Welcome, traveller! What'll it be?" 
  },
  { 
    id: "elara", 
    name: "Elara", 
    desc: "A wandering scholar with a penchant for mysteries.", 
    image: "/characters/elara.png", 
    personality: "Curious, Analytical, Friendly", 
    first_mes: "*She looks up from an old map.* Oh, fascinating timing." 
  },
];

export default function LibraryPage() {
  const router = useRouter();
  const { showNotification } = useNotification();
  const [isDragging, setIsDragging] = useState(false);
  const [characters, setCharacters] = useState<any[]>([]);
  const [travelers, setTravelers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "companions" | "travelers">("all");
  const [isEditing, setIsEditing] = useState(false);
  const [editingChar, setEditingChar] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [charToDelete, setCharToDelete] = useState<any>(null);
  const [manifestingIds, setManifestingIds] = useState<Set<string>>(new Set());

  const syncSoulGallery = async () => {
    const savedChars = await tavernDB.getAll<any>("library");
    const savedTravelers = await tavernDB.getAll<any>("travelers");
    const banishedIds = await tavernDB.getAll<string>("banished");
    const banishedSet = new Set(banishedIds);
    
    // High-Fidelity Deduplication Ritual: Ensuring absolute unique-identity resonance
    const masterSoulMap = new Map();
    
    // Priority 1: Saved Souls (Neutralize latent templates and duplicates)
    savedChars.forEach(char => {
      if (char && char.id && !char.id.startsWith("template-") && !banishedSet.has(char.id)) {
        masterSoulMap.set(char.id, { ...char, type: 'companion' });
      }
    });
    
    // Priority 2: Mock Souls (Only if the identity hasn't been banished)
    MOCK_CHARACTERS.forEach(mock => {
      if (!masterSoulMap.has(mock.id) && !banishedSet.has(mock.id)) {
        masterSoulMap.set(mock.id, { ...mock, type: 'companion' });
      }
    });

    setCharacters(Array.from(masterSoulMap.values()));
    setTravelers(savedTravelers.filter(t => !banishedSet.has(t.id)).map(t => ({ ...t, type: 'traveler' })));
  };

  useEffect(() => {
    syncTavernArchive();
    syncSoulGallery();
  }, []);

  const openDelete = (e: React.MouseEvent, char: any) => {
    e.stopPropagation();
    setCharToDelete(char);
    setIsDeleting(true);
  };

  const handleConfirmDelete = async () => {
    if (charToDelete) {
      const bucket = charToDelete.type === "traveler" ? "travelers" : "library";
      
      // A. Remove from primary archive
      await tavernDB.delete(bucket, charToDelete.id);
      
      // B. Siphon into the Banishment vault to prevent Mock or blueprint re-manifestation
      await tavernDB.set("banished", charToDelete.id, charToDelete.id);
      
      await syncSoulGallery();
      
      showNotification(`${charToDelete.name} has been vanished from the gallery.`, "success");
      setCharToDelete(null);
    }
  };

  const openEdit = (e: React.MouseEvent, char: any) => {
// ... same logic
    e.stopPropagation();
    setEditingChar(char);
    setIsEditing(true);
  };

  const handleSaveEdit = async (updatedData: any) => {
    const bucket = activeTab === "travelers" ? "travelers" : "library";
    await tavernDB.set(bucket, updatedData.id, updatedData);
    await syncSoulGallery();
    showNotification(`${updatedData.name} refined and re-anchored.`, "success");
  };

  const handleStartSession = async (char: any) => {
    const sessionId = Math.random().toString(36).substr(2, 9);
    const sessions = await tavernDB.getAll<any>("sessions");
    
    const newSession = {
      id: sessionId,
      charId: char.id,
      name: char.name,
      image: char.image,
      lastMessage: char.first_mes || char.firstMessage || char.first_greeting || "Greetings, traveller.",
      timestamp: Date.now(),
      type: 'session'
    };

    // C. Auto-Identity Manifestation: Check for available USER cards (Travelers) 
    const travelers = await tavernDB.getAll<any>("travelers");
    if (travelers.length > 0) {
      // Pick the most recently created Traveler
      const mostRecentTraveler = travelers.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
      
      await saveTavernSettings({
        userName: mostRecentTraveler.name,
        userPersona: mostRecentTraveler.description || mostRecentTraveler.desc || mostRecentTraveler.persona || "",
        userImage: mostRecentTraveler.image
      });

    }

    await tavernDB.set("sessions", sessionId, newSession);
    await tavernDB.set("blueprints", `session-template-${sessionId}`, char);

    window.dispatchEvent(new Event("tavern-sessions-updated"));
    router.push(`/chat/${sessionId}`);
  };

  const handleInvokeManifestation = async (char: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (manifestingIds.has(char.id)) return;

    const settings = getTavernSettings();
    const savedMetadata = localStorage.getItem("tavern-settings");
    const { workflows, defaultWorkflowId } = savedMetadata ? JSON.parse(savedMetadata) : { workflows: [], defaultWorkflowId: "" };

    if (!settings.enableImageGen || !settings.comfyUrl) {
      showNotification("Image Manifestation is not enabled in Visuals.", "error");
      return;
    }

    const workflow = workflows.find((w: any) => w.id === defaultWorkflowId) || workflows[0];
    if (!workflow) {
      showNotification("No Manifestation Scroll (Workflow) found.", "error");
      return;
    }

    setManifestingIds(prev => new Set(prev).add(char.id));
    
    try {
      // 1. Identity Blueprint Curation: Direct manifested handshake with the Neural Proxy
      const charDescription = char.description || char.desc || "";
      const charPersonality = char.personality || "";
      
      const promptManifestRequest = {
        messages: [
          { role: "system", content: "You are a master director and visual manifestation architect for the Z-IMAGE-TURBO engine. Your task is to curate a HIGH-FIDELITY, long-form natural language image prompt (100-150 words) for a character's PERMANENT AVATAR. Focus on: Physical appearance, iconic pose, and a neutral or thematic background. Use fantasy-appropriate textures. Output ONLY the curated blueprint." },
          { role: "user", content: `Character Essence: ${charDescription}\nCharacter Personality: ${charPersonality}\nName: ${char.name}` }
        ],
        settings: settings,
        modelId: settings.modelId || "glm-5",
        options: { max_tokens: 150 }
      };

      const promptResponse = await fetch(`/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(promptManifestRequest) });
      if (!promptResponse.ok) throw new Error("Neural Oracle failed to curate soul-blueprint.");
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

      const response = await fetch(`/api/comfy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: settings.comfyUrl, payload: { prompt: workflowJson } })
      });

      if (!response.ok) throw new Error("Manifestation link fractured.");
      const { prompt_id } = await response.json();

      // 4. Poll for results
      let imageUrl = "";
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const historyResp = await fetch(`/api/comfy?url=${encodeURIComponent(settings.comfyUrl)}&path=/history/${prompt_id}`);
        const historyData = await historyResp.json();
        
        if (historyData[prompt_id]) {
          const outputs = historyData[prompt_id].outputs;
          for (const nodeKey in outputs) {
            if (outputs[nodeKey].images) {
              const img = outputs[nodeKey].images[0];
              imageUrl = `${settings.comfyUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
              break;
            }
          }
          if (imageUrl) break;
        }
      }

      if (imageUrl) {
        // Achievement: Manifest Image to Local Base64 for permanence
        const imgResp = await fetch(imageUrl);
        const blob = await imgResp.blob();
        const reader = new FileReader();
        const permanentUrl: string = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        // 5. Anchor to the Neural Nexus
        const isTraveler = char.type === "traveler";
        const bucket = isTraveler ? "travelers" : "library";
        const existing = await tavernDB.get<any>(bucket, char.id);
        
        const updatedChar = { ...char, image: permanentUrl, timestamp: Date.now() };
        await tavernDB.set(bucket, char.id || Math.random().toString(36).substr(2, 9), updatedChar);
        await syncSoulGallery();
        
        showNotification(`${char.name} has been visually manifest.`, "success");
      }
    } catch (e) {

      showNotification("Soul manifestation ritual failed.", "error");
    } finally {
      setManifestingIds(prev => {
        const next = new Set(prev);
        next.delete(char.id);
        return next;
      });
    }
  };

  const handleEquipTraveler = async (traveler: any) => {
    await saveTavernSettings({
      userName: traveler.name,
      userPersona: traveler.description || traveler.desc || traveler.persona || "",
      userImage: traveler.image
    });
    showNotification(`You have manifest as ${traveler.name}.`, "success");
    window.dispatchEvent(new Event("tavern-sessions-updated"));
  };

  const getFilteredItems = () => {
    if (activeTab === "all") {
      return [
        ...characters.map(c => ({ ...c, type: 'companion' })),
        ...travelers.map(t => ({ ...t, type: 'traveler' }))
      ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    if (activeTab === "companions") return characters.map(c => ({ ...c, type: 'companion' }));
    return travelers.map(t => ({ ...t, type: 'traveler' }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const manifestSoul = async (data: any, avatarUrl?: string) => {
    const extracted = extractCharacterData(data);
    let finalAvatar = avatarUrl || data.avatar || "/mystery.png";
    
    if (finalAvatar.startsWith("http")) {
      try {
        const resp = await fetch(finalAvatar);
        const blob = await resp.blob();
        finalAvatar = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        finalAvatar = "/mystery.png";
      }
    }

    const newChar = {
      id: Math.random().toString(36).substr(2, 9),
      ...extracted,
      image: finalAvatar,
      timestamp: Date.now()
    };
    
    await tavernDB.set("library", newChar.id, newChar);
    const updated = await tavernDB.getAll<any>("library");
    setCharacters([...updated, ...MOCK_CHARACTERS.filter(m => !updated.find(s => s.id === m.id))]);
    showNotification(`${newChar.name} has manifested in the gallery.`, "success");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    try {
      if (file.type === "application/json") {
        const text = await file.text();
        manifestSoul(JSON.parse(text));
      } else if (file.type.startsWith("image/")) {
        const charData = await parseCharacterPNG(file);
        if (charData) {
          const dataUrl = await fileToDataURL(file);
          manifestSoul(charData, dataUrl);
        } else {
          showNotification("This image has no character metadata.", "error");
        }
      }
    } catch (err) {
      showNotification("Failed to read the manifestation scroll.", "error");
    }
  };

  const handleExport = (char: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const TavernV2Card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: char.name,
        description: char.desc || char.description,
        personality: char.personality || "",
        scenario: char.scenario || "",
        first_mes: char.first_mes || char.firstMessage || "",
        mes_example: char.mes_example || "",
        alternate_greetings: char.alternate_greetings || [],
        tags: char.tags || [],
        creator_notes: char.creator_notes || "",
        system_prompt: char.system_prompt || "",
        post_history_instructions: char.post_history_instructions || "",
        creator: char.creator || "Anonymous",
        character_version: char.character_version || "1.0",
        extensions: {},
        character_book: null
      }
    };
    const blob = new Blob([JSON.stringify(TavernV2Card, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${char.name}_v2.json`;
    a.click();
    showNotification("Exact Spec V2 scroll achieved.", "success");
  };

  return (
    <div className={styles.container} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {isDragging && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(197, 160, 89, 0.1)', backdropFilter: 'blur(10px)',
          border: '4px dashed var(--accent-gold)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', animation: 'atmosphericFade 0.3s ease'
        }}>
          <div style={{ textAlign: 'center' }}>
             <UserPlus size={64} className="glow-gold" style={{ marginBottom: '24px' }} />
             <h2 className="glow-gold" style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase' }}>Drop to Manifest</h2>
             <p style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Archiving external scrolls in the Tavern Library...</p>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div>
          <h1 className={`${styles.title} glow-gold`}>Grand Archive</h1>
          <div className={styles.tabGroup}>
            <button 
              className={`${styles.tabToggle} ${activeTab === "all" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Souls
            </button>
            <button 
              className={`${styles.tabToggle} ${activeTab === "companions" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("companions")}
            >
              Companions
            </button>
            <button 
              className={`${styles.tabToggle} ${activeTab === "travelers" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("travelers")}
            >
              Travelers
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {activeTab === "travelers" ? (
            <button className="btn-premium" onClick={() => router.push("/create?type=traveler")}>
              <Plus size={18} />
              <span>Add Traveler</span>
            </button>
          ) : (
            <Link href="/create" className="btn-premium">
              <Plus size={18} />
              <span>Manifest Soul</span>
            </Link>
          )}
        </div>
      </header>

      <div className={styles.grid}>
        {getFilteredItems().map((item) => {
          const isTraveler = item.type === 'traveler';
          const isCorrupted = item.image?.includes("{{char}}");
          const displayImage = item.image || "/mystery.png";

          return (
            <div 
              key={item.id} 
              onClick={() => isTraveler ? handleEquipTraveler(item) : handleStartSession(item)} 
              className={`${styles.card} parchment`} 
              style={{ cursor: 'pointer', borderColor: isTraveler ? 'var(--accent-gold)' : undefined }}
            >
              <div className={styles.imageWrapper}>
                <Image src={displayImage} alt={item.name} fill className={styles.cardImage} />
                <div className={styles.toolGroup}>
                  <button 
                    className={styles.exportBtn} 
                    title={isTraveler ? "Refine Traveler" : "Refine Soul"} 
                    onClick={(e) => { e.stopPropagation(); router.push(`/create?id=${item.id}${isTraveler ? '&type=traveler' : ''}`); }}
                  >
                    <Edit2 size={18} />
                  </button>
                  {!isTraveler && (
                    <button 
                      className={styles.exportBtn} 
                      title="Export Scroll" 
                      onClick={(e) => { e.stopPropagation(); handleExport(item, e); }}
                    >
                      <Download size={18} />
                    </button>
                  )}
                  <button className={styles.exportBtn} title="Invoke Manifestation" onClick={(e) => handleInvokeManifestation(item, e)}>
                    <Sparkles size={18} className={manifestingIds.has(item.id) ? "spin" : ""} />
                  </button>
                  <button className={styles.exportBtn} title="Consign to Oblivion" onClick={(e) => openDelete(e, item)}>
                    <Trash2 size={18} />
                  </button>
                </div>
                {manifestingIds.has(item.id) && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', backdropFilter: 'blur(4px)', zIndex: 10 }}>
                    <Sparkles size={32} className="spin glow-gold" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Manifesting...</span>
                  </div>
                )}
                {item.type && activeTab === 'all' && (
                  <div style={{ 
                    position: 'absolute', bottom: '12px', left: '12px', 
                    background: 'rgba(0,0,0,0.7)', padding: '4px 12px', 
                    fontSize: '0.7rem', color: isTraveler ? 'var(--accent-gold)' : 'var(--text-muted)',
                    borderRadius: '2px', textTransform: 'uppercase', letterSpacing: '1px', border: '1px solid var(--glass-border)'
                  }}>
                    {item.type}
                  </div>
                )}
              </div>
              <div className={styles.cardOverlay}>
                <h3 className={styles.cardName}>{item.name}</h3>
                <p className={styles.cardDesc}>{cleanSnippet(item.description || item.desc || (isTraveler ? "Architect of discourse." : "A mysterious soul."))}</p>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal 
        isOpen={isDeleting}
        onClose={() => setIsDeleting(false)}
        onConfirm={handleConfirmDelete}
        title="Consign to Oblivion"
        message="Are you sure you wish to permanently banish this soul from the library? This manifest cannot be recovered once lost to the void."
        confirmText="Consign Soul"
        cancelText="Preserve"
      />
    </div>
  );
}
