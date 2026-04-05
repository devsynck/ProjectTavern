import { tavernDB } from "./db";

export interface TavernSettings {
  apiUrl: string;
  apiKey: string;
  modelId: string;
  inferenceProvider: string;
  comfyUrl: string;
  enableImageGen: boolean;
  autoGenerateImages: boolean;
  autoTTS: boolean;
  userName: string;
  userPersona: string;
  userImage: string;
  ttsProvider: string;
  ttsVoice: string;
  kokoroUrl: string;
  kokoroVoice: string;
  providerConfigs: Record<string, { apiUrl: string; apiKey: string; modelId: string }>;
}

export const DEFAULT_SETTINGS: TavernSettings = {
  apiUrl: "http://127.0.0.1:8080",
  apiKey: "",
  modelId: "glm-5",
  inferenceProvider: "OpenAI",
  comfyUrl: "http://127.0.0.1:8188",
  enableImageGen: true,
  autoGenerateImages: false,
  autoTTS: false,
  userName: "User",
  userPersona: "A user of Project Tavern.",
  userImage: "/characters/mystery.png",
  ttsProvider: "WebSpeech",
  ttsVoice: "",
  kokoroUrl: "http://localhost:8880/v1",
  kokoroVoice: "af_sky",
  providerConfigs: {
    "Ollama": { apiUrl: "http://localhost:11434/v1", apiKey: "", modelId: "llama3" },
    "Llama.cpp": { apiUrl: "http://localhost:8080/v1", apiKey: "", modelId: "gpt-4o" },
    "LM Studio": { apiUrl: "http://localhost:1234/v1", apiKey: "", modelId: "model-identifier" },
    "OpenRouter": { apiUrl: "https://openrouter.ai/api/v1", apiKey: "", modelId: "openai/gpt-4o" },
    "Z.AI": { apiUrl: "https://api.z.ai/api/paas/v4/", apiKey: "", modelId: "glm-4" },
    "Mistral": { apiUrl: "https://api.mistral.ai/v1", apiKey: "", modelId: "mistral-large-latest" },
    "Groq": { apiUrl: "https://api.groq.com/openai/v1", apiKey: "", modelId: "llama3-70b-8192" },
    "Together": { apiUrl: "https://api.together.xyz/v1", apiKey: "", modelId: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
    "Gemini": { apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", apiKey: "", modelId: "gemini-2.0-flash" },
    "Custom": { apiUrl: "http://127.0.0.1:8080/v1", apiKey: "", modelId: "" }
  }
};

export interface TavernConfiguration {
  settings: TavernSettings;
  workflows: { id: string; name: string; json: string }[];
  defaultWorkflowId: string;
}

export const DEFAULT_CONFIGURATION: TavernConfiguration = {
  settings: DEFAULT_SETTINGS,
  workflows: [
    { 
      id: "default-wf", 
      name: "Classic Portrait", 
      json: '{"3":{"inputs":{"seed":0,"steps":20,"cfg":8,"sampler_name":"euler","scheduler":"normal","denoise":1,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]},"class_type":"KSampler"},"4":{"inputs":{"ckpt_name":"v1-5-pruned-emaonly.ckpt"},"class_type":"CheckpointLoaderSimple"},"5":{"inputs":{"width":512,"height":512,"batch_size":1},"class_type":"EmptyLatentImage"},"6":{"inputs":{"text":"masterpiece, high quality, 1human, portrait","clip":["4",1]},"class_type":"CLIPTextEncode"},"7":{"inputs":{"text":"low quality, bad quality, blurry","clip":["4",1]},"class_type":"CLIPTextEncode"},"8":{"inputs":{"samples":["3",0],"vae":["4",2]},"class_type":"VAEDecode"},"9":{"inputs":{"filename_prefix":"Tavern","images":["8",0]},"class_type":"SaveImage"}}'
    }
  ],
  defaultWorkflowId: "default-wf"
};

// Settings Cache: Synchronous access for UI components (Must be initialized via syncSettings)
let cachedConfig: TavernConfiguration | null = null;

export const syncSettings = async (): Promise<TavernConfiguration> => {
  if (typeof window === "undefined") return DEFAULT_CONFIGURATION;
  
  // 1. Attempt to load from the Database (IndexedDB)
  const idb = await tavernDB.get<TavernConfiguration>("settings", "archive");
  if (idb) {
    cachedConfig = idb;
    return idb;
  }

  // 2. Migration Process: Load legacy localStorage if the Database is empty
  const legacy = localStorage.getItem("tavern-settings");
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy);
      const migrated = {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        workflows: parsed.workflows || DEFAULT_CONFIGURATION.workflows,
        defaultWorkflowId: parsed.defaultWorkflowId || DEFAULT_CONFIGURATION.defaultWorkflowId
      };
      await tavernDB.set("settings", "archive", migrated);
      localStorage.removeItem("tavern-settings"); // Remove legacy settings
      cachedConfig = migrated;
      return migrated;
    } catch (e) {}
  }

  cachedConfig = DEFAULT_CONFIGURATION;
  return DEFAULT_CONFIGURATION;
};

export const getSettings = (): TavernConfiguration => {
  if (typeof window === "undefined") return DEFAULT_CONFIGURATION;
  return cachedConfig || DEFAULT_CONFIGURATION;
};

export const getTavernSettings = (): TavernSettings => {
  return getSettings().settings;
};

export const saveSettings = async (config: Partial<TavernConfiguration>) => {
  if (typeof window === "undefined") return;
  const current = getSettings();
  const updated = {
    settings: config.settings ? { ...current.settings, ...config.settings } : current.settings,
    workflows: config.workflows || current.workflows,
    defaultWorkflowId: config.defaultWorkflowId || current.defaultWorkflowId
  };
  cachedConfig = updated;
  await tavernDB.set("settings", "archive", updated);
  
  // Dispatch notification for visual sync across tabs
  window.dispatchEvent(new Event("tavern-settings-updated"));
};

export const saveTavernSettings = async (settings: Partial<TavernSettings>) => {
  await saveSettings({ settings: settings as any });
};

