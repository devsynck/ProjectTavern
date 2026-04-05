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
import { getTavernSettings, saveTavernSettings, syncSettings } from "@/utils/settings";

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
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "characters" | "user_profiles">("all");
  const [isEditing, setIsEditing] = useState(false);
  const [editingChar, setEditingChar] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [charToDelete, setCharToDelete] = useState<any>(null);
  const [manifestingIds, setManifestingIds] = useState<Set<string>>(new Set());

  const syncLibrary = async () => {
    const savedChars = await tavernDB.getAll<any>("library");
    const savedUserProfiles = await tavernDB.getAll<any>("user_profiles");
    const deletedIds = await tavernDB.getAll<string>("deleted");
    const deletedSet = new Set(deletedIds);
    
    // High-Fidelity Deduplication Process: Ensuring absolute unique-identity alignment
    const masterCharacterMap = new Map();
    
    // Priority 1: Saved Characters (Neutralize latent templates and duplicates)
    savedChars.forEach(char => {
      if (char && char.id && !char.id.startsWith("template-") && !deletedSet.has(char.id)) {
        masterCharacterMap.set(char.id, { ...char, type: 'character' });
      }
    });
    
    // Priority 2: Default Characters (Only if the identity hasn't been deleted)
    MOCK_CHARACTERS.forEach(mock => {
      if (!masterCharacterMap.has(mock.id) && !deletedSet.has(mock.id)) {
        masterCharacterMap.set(mock.id, { ...mock, type: 'character' });
      }
    });

    setCharacters(Array.from(masterCharacterMap.values()));
    setUserProfiles(savedUserProfiles.filter(t => !deletedSet.has(t.id)).map(t => ({ ...t, type: 'user_profile' })));
  };

  useEffect(() => {
    syncSettings();
    syncLibrary();
  }, []);

  const openDelete = (e: React.MouseEvent, char: any) => {
    e.stopPropagation();
    setCharToDelete(char);
    setIsDeleting(true);
  };

  const handleConfirmDelete = async () => {
    if (charToDelete) {
      const bucket = charToDelete.type === "user_profile" ? "user_profiles" : "library";
      
      // A. Remove from primary archive
      await tavernDB.delete(bucket, charToDelete.id);
      
      // B. Add to the deletion list to prevent Default or blueprint re-creation
      await tavernDB.set("deleted", charToDelete.id, charToDelete.id);
      
      await syncLibrary();
      
      showNotification(`${charToDelete.name} has been removed from the library.`, "success");
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
    const bucket = activeTab === "user_profiles" ? "user_profiles" : "library";
    await tavernDB.set(bucket, updatedData.id, updatedData);
    await syncLibrary();
    showNotification(`${updatedData.name} updated and saved.`, "success");
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

    // C. Auto-Identity Selection: Check for available USER profiles (User Profiles) 
    const userProfiles = await tavernDB.getAll<any>("user_profiles");
    if (userProfiles.length > 0) {
      // Pick the most recently created Profile
      const mostRecentProfile = userProfiles.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
      
      await saveTavernSettings({
        userName: mostRecentProfile.name,
        userPersona: mostRecentProfile.description || mostRecentProfile.desc || mostRecentProfile.persona || "",
        userImage: mostRecentProfile.image
      });

    }

    await tavernDB.set("sessions", sessionId, newSession);
    await tavernDB.set("templates", `session-template-${sessionId}`, char);

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
      showNotification("Image Generation is not enabled in Visuals.", "error");
      return;
    }

    const workflow = workflows.find((w: any) => w.id === defaultWorkflowId) || workflows[0];
    if (!workflow) {
      showNotification("No Generation Template (Workflow) found.", "error");
      return;
    }

    setManifestingIds(prev => new Set(prev).add(char.id));
    
    try {
      // 1. Character Description Generation: Direct generation handshake with the AI Proxy
      const charDescription = char.description || char.desc || "";
      const charPersonality = char.personality || "";
      
      const promptManifestRequest = {
        messages: [
          { role: "system", content: "You are a master director and visual style architect for the Z-IMAGE-TURBO engine. Your task is to curate a HIGH-FIDELITY, long-form natural language image prompt (100-150 words) for a character's PERMANENT AVATAR. Focus on: Physical appearance, iconic pose, and a neutral or thematic background. Use photorealistic textures. Output ONLY the curated description." },
          { role: "user", content: `Character Details: ${charDescription}\nCharacter Personality: ${charPersonality}\nName: ${char.name}` }
        ],
        settings: settings,
        modelId: settings.modelId || "glm-5",
        options: { max_tokens: 150 }
      };

      const promptResponse = await fetch(`/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(promptManifestRequest) });
      if (!promptResponse.ok) throw new Error("AI Provider failed to generate character profile.");
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

        // 5. Anchor to the Database
        const isUserProfileModeSaved = char.type === "user_profile";
        const bucket = isUserProfileModeSaved ? "user_profiles" : "library";
        const existing = await tavernDB.get<any>(bucket, char.id);
        
        const updatedChar = { ...char, image: permanentUrl, timestamp: Date.now() };
        await tavernDB.set(bucket, char.id || Math.random().toString(36).substr(2, 9), updatedChar);
        await syncLibrary();
        
        showNotification(`${char.name} has been visually generated.`, "success");
      }
    } catch (e) {

      showNotification("Failed to generate character image.", "error");
    } finally {
      setManifestingIds(prev => {
        const next = new Set(prev);
        next.delete(char.id);
        return next;
      });
    }
  };

  const handleEquipProfile = async (profile: any) => {
    await saveTavernSettings({
      userName: profile.name,
      userPersona: profile.description || profile.desc || profile.persona || "",
      userImage: profile.image
    });
    showNotification(`You are now using the profile ${profile.name}.`, "success");
    window.dispatchEvent(new Event("tavern-sessions-updated"));
  };

  const getFilteredItems = () => {
    if (activeTab === "all") {
      return [
        ...characters.map(c => ({ ...c, type: 'character' })),
        ...userProfiles.map(t => ({ ...t, type: 'user_profile' }))
      ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    if (activeTab === "characters") return characters.map(c => ({ ...c, type: 'character' }));
    return userProfiles.map(t => ({ ...t, type: 'user_profile' }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const createCharacter = async (data: any, avatarUrl?: string) => {
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
    showNotification(`${newChar.name} has been added to the library.`, "success");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    try {
      if (file.type === "application/json") {
        const text = await file.text();
        createCharacter(JSON.parse(text));
      } else if (file.type.startsWith("image/")) {
        const charData = await parseCharacterPNG(file);
        if (charData) {
          const dataUrl = await fileToDataURL(file);
          createCharacter(charData, dataUrl);
        } else {
          showNotification("This image has no character metadata.", "error");
        }
      }
    } catch (err) {
      showNotification("Failed to read the character file.", "error");
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
    showNotification("Spec V2 export complete.", "success");
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
              <h2 className="glow-gold" style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase' }}>Drop to Import</h2>
              <p style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Importing character files into the Library...</p>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div>
          <h1 className={`${styles.title} glow-gold`}>Character Library</h1>
          <div className={styles.tabGroup}>
            <button 
              className={`${styles.tabToggle} ${activeTab === "all" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Profiles
            </button>
            <button 
              className={`${styles.tabToggle} ${activeTab === "characters" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("characters")}
            >
              Characters
            </button>
            <button 
              className={`${styles.tabToggle} ${activeTab === "user_profiles" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("user_profiles")}
            >
              User Profiles
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {activeTab === "user_profiles" ? (
            <button className="btn-premium" onClick={() => router.push("/create?type=user_profile")}>
              <Plus size={18} />
              <span>Add Profile</span>
            </button>
          ) : (
            <Link href="/create" className="btn-premium">
              <Plus size={18} />
              <span>Add Character</span>
            </Link>
          )}
        </div>
      </header>

      <div className={styles.grid}>
        {getFilteredItems().map((item) => {
          const isUserProfile = item.type === 'user_profile';
          const isCorrupted = item.image?.includes("{{char}}");
          const displayImage = item.image || "/mystery.png";

          return (
            <div 
              key={item.id} 
              onClick={() => isUserProfile ? handleEquipProfile(item) : handleStartSession(item)} 
              className={`${styles.card} parchment`} 
              style={{ cursor: 'pointer', borderColor: isUserProfile ? 'var(--accent-gold)' : undefined }}
            >
              <div className={styles.imageWrapper}>
                <Image src={displayImage} alt={item.name} fill className={styles.cardImage} />
                <div className={styles.toolGroup}>
                  <button 
                    className={styles.exportBtn} 
                    title={isUserProfile ? "Edit Profile" : "Edit Character"} 
                    onClick={(e) => { e.stopPropagation(); router.push(`/create?id=${item.id}${isUserProfile ? '&type=user_profile' : ''}`); }}
                  >
                    <Edit2 size={18} />
                  </button>
                  {!isUserProfile && (
                    <button 
                      className={styles.exportBtn} 
                      title="Export JSON" 
                      onClick={(e) => { e.stopPropagation(); handleExport(item, e); }}
                    >
                      <Download size={18} />
                    </button>
                  )}
                  <button className={styles.exportBtn} title="Generate Image" onClick={(e) => handleInvokeManifestation(item, e)}>
                    <Sparkles size={18} className={manifestingIds.has(item.id) ? "spin" : ""} />
                  </button>
                  <button className={styles.exportBtn} title="Delete Profile" onClick={(e) => openDelete(e, item)}>
                    <Trash2 size={18} />
                  </button>
                </div>
                {manifestingIds.has(item.id) && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', backdropFilter: 'blur(4px)', zIndex: 10 }}>
                    <Sparkles size={32} className="spin glow-gold" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Generating...</span>
                  </div>
                )}
                {item.type && activeTab === 'all' && (
                  <div style={{ 
                    position: 'absolute', bottom: '12px', left: '12px', 
                    background: 'rgba(0,0,0,0.7)', padding: '4px 12px', 
                    fontSize: '0.7rem', color: isUserProfile ? 'var(--accent-gold)' : 'var(--text-muted)',
                    borderRadius: '2px', textTransform: 'uppercase', letterSpacing: '1px', border: '1px solid var(--glass-border)'
                  }}>
                    {item.type.replace('_', ' ')}
                  </div>
                )}
              </div>
              <div className={styles.cardOverlay}>
                <h3 className={styles.cardName}>{item.name}</h3>
                <p className={styles.cardDesc}>{cleanSnippet(item.description || item.desc || (isUserProfile ? "User Profile" : "A mysterious profile."))}</p>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal 
        isOpen={isDeleting}
        onClose={() => setIsDeleting(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Profile"
        message="Are you sure you wish to permanently remove this profile from the library? This data cannot be recovered once deleted."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
