import { tavernDB } from "./db";

export interface TavernSettings {
  apiUrl: string;
  apiKey: string;
  modelId: string;
  inferenceProvider: string;
  comfyUrl: string;
  enableImageGen: boolean;
  userName: string;
  userPersona: string;
  userImage: string;
  ttsProvider: string;
  ttsVoice: string;
  kokoroUrl: string;
  kokoroVoice: string;
}

export const DEFAULT_SETTINGS: TavernSettings = {
  apiUrl: "http://127.0.0.1:8080",
  apiKey: "",
  modelId: "glm-5",
  inferenceProvider: "OpenAI",
  comfyUrl: "http://127.0.0.1:8188",
  enableImageGen: true,
  userName: "Traveller",
  userPersona: "A mysterious traveller in the Tavern.",
  userImage: "/characters/mystery.png",
  ttsProvider: "WebSpeech",
  ttsVoice: "",
  kokoroUrl: "http://localhost:8880/v1",
  kokoroVoice: "af_sky"
};

export interface TavernArchive {
  settings: TavernSettings;
  workflows: { id: string; name: string; json: string }[];
  defaultWorkflowId: string;
}

export const DEFAULT_ARCHIVE: TavernArchive = {
  settings: DEFAULT_SETTINGS,
  workflows: [
    { id: "default-wf", name: "Classic Portrait", json: '{"6":{"inputs":{"text":"masterpiece, high quality, 1human, portrait"},"class_type":"CLIPTextEncode"},"8":{"inputs":{"samples":["3",0],"vae":["4",0]},"class_type":"VAEDecode"}}' }
  ],
  defaultWorkflowId: "default-wf"
};

// Neural Cache: Synchronous access for UI components (Must be initialized via syncTavernArchive)
let cachedArchive: TavernArchive | null = null;

export const syncTavernArchive = async (): Promise<TavernArchive> => {
  if (typeof window === "undefined") return DEFAULT_ARCHIVE;
  
  // 1. Attempt to siphon from the Neural Nexus (IndexedDB)
  const idb = await tavernDB.get<TavernArchive>("settings", "archive");
  if (idb) {
    cachedArchive = idb;
    return idb;
  }

  // 2. Migration Ritual: Siphon legacy localStorage if the Nexus is empty
  const legacy = localStorage.getItem("tavern-settings");
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy);
      const migrated = {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        workflows: parsed.workflows || DEFAULT_ARCHIVE.workflows,
        defaultWorkflowId: parsed.defaultWorkflowId || DEFAULT_ARCHIVE.defaultWorkflowId
      };
      await tavernDB.set("settings", "archive", migrated);
      localStorage.removeItem("tavern-settings"); // Neutralize legacy manifest
      cachedArchive = migrated;
      return migrated;
    } catch (e) {}
  }

  cachedArchive = DEFAULT_ARCHIVE;
  return DEFAULT_ARCHIVE;
};

export const getTavernArchive = (): TavernArchive => {
  if (typeof window === "undefined") return DEFAULT_ARCHIVE;
  return cachedArchive || DEFAULT_ARCHIVE;
};

export const getTavernSettings = (): TavernSettings => {
  return getTavernArchive().settings;
};

export const saveTavernArchive = async (archive: Partial<TavernArchive>) => {
  if (typeof window === "undefined") return;
  const current = getTavernArchive();
  const updated = {
    settings: archive.settings ? { ...current.settings, ...archive.settings } : current.settings,
    workflows: archive.workflows || current.workflows,
    defaultWorkflowId: archive.defaultWorkflowId || current.defaultWorkflowId
  };
  cachedArchive = updated;
  await tavernDB.set("settings", "archive", updated);
  
  // Dispatch notification for visual sync across tabs
  window.dispatchEvent(new Event("tavern-settings-updated"));
};

export const saveTavernSettings = async (settings: Partial<TavernSettings>) => {
  await saveTavernArchive({ settings: settings as any });
};

