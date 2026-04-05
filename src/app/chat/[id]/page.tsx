"use client";

import { useState, useRef, useEffect, use, memo, useCallback, useMemo } from "react";
import Image from "next/image";
import { Send, Image as ImageIcon, Volume2, Wand2, Plus, Sparkles, Bot, Loader2 } from "lucide-react";
import styles from "../chat.module.css";
import { buildTavernPrompt, buildChatMessages } from "@/utils/promptBuilder";
import { getTavernSettings, syncSettings } from "@/utils/settings";
import { useNotification } from "@/components/NotificationProvider";
import { tavernDB } from "@/utils/db";

interface Message {
  sender: string;
  content: string;
  type: 'character' | 'user' | 'narrator';
  avatar?: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
}

// 1. Memoized Dynamic Text Parser
const DynamicText = memo(({ text }: { text: string }) => {
  if (!text) return null;
  const parts = text.split(/(\*.*?\*|".*?")/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <i key={i} style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}>
              {part.slice(1, -1)}
            </i>
          );
        } else if (part.startsWith('"') && part.endsWith('"')) {
          return (
            <b key={i} style={{ color: "#ffffff", fontWeight: 700 }}>{part}</b>
          );
        }
        return <span key={i} style={{ color: "#e0e0e0" }}>{part}</span>;
      })}
    </>
  );
});
DynamicText.displayName = "DynamicText";

// 2. Memoized Message Component
const ChatMessage = memo(({ 
  msg, 
  index, 
  isUser, 
  currentUserImage, 
  onGenerateImage, 
  onCancelGenerateImage,
  onSpeak,
  onStopSpeak,
  isSpeakingAnywhere
}: { 
  msg: Message, 
  index: number, 
  isUser: boolean, 
  currentUserImage: string,
  onGenerateImage: (i: number) => void,
  onCancelGenerateImage: (i: number) => void,
  onSpeak: (t: string) => void,
  onStopSpeak: () => void,
  isSpeakingAnywhere: boolean
}) => {
  const displayType = isUser ? "user" : msg.type;

  return (
    <div className={styles.message}>
      {displayType === "narrator" ? (
        <p className={styles.narrator}><DynamicText text={msg.content} /></p>
      ) : (
        <div className={isUser ? styles.userWrapper : styles.charWrapper}>
          {(msg.avatar || (isUser && currentUserImage)) && (
            <div className={styles.avatarContainer}>
              <Image src={msg.avatar || currentUserImage} alt={msg.sender} fill className={styles.avatar} />
            </div>
          )}
          
          <div className={styles.messageBody}>
            <div className={styles.metadata}>
              <span className={isUser ? styles.userName : styles.name} style={{ fontSize: '1.4rem' }}>
                {msg.sender}
              </span>
            </div>
            <div className={`${styles.content} ${isUser ? styles.userGlass : "obsidianParchment"}`}>
              <DynamicText text={msg.content} />
            </div>

            <div className={styles.messageAddons} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className={styles.miniTool} onClick={() => onGenerateImage(index)} title="Generate Image"
                  style={{ opacity: 0.4, transition: 'all 0.2s', background: 'transparent', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ImageIcon size={14} />
                  <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Image</span>
                </button>
                {isSpeakingAnywhere ? (
                  <button className={styles.miniTool} onClick={onStopSpeak} title="Stop Audio"
                    style={{ opacity: 0.8, transition: 'all 0.2s', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                    <Loader2 className="spin" size={14} />
                    <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Stop</span>
                  </button>
                ) : (
                  <button className={styles.miniTool} onClick={() => onSpeak(msg.content)} title="Speak Text"
                    style={{ opacity: 0.4, transition: 'all 0.2s', background: 'transparent', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                    <Volume2 size={14} />
                    <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Speak</span>
                  </button>
                )}
              </div>

              {msg.isGeneratingImage && (
                <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', color: 'var(--accent-gold)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                  <Sparkles className="spin" size={14} /> 
                  <span>Generating image...</span>
                  <button 
                    onClick={() => onCancelGenerateImage(index)}
                    style={{ 
                      background: 'rgba(248, 113, 113, 0.2)', color: '#f87171', border: '1px solid #f8717133', 
                      padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6rem',
                      marginLeft: '8px', textTransform: 'uppercase'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {msg.imageUrl && (
                <div className={styles.inlineImageWrapper} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', width: '70%', maxWidth: '400px' }}>
                  <img src={msg.imageUrl} alt="Generated Image" style={{ width: '100%', borderRadius: '4px', border: '1px solid var(--glass-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
ChatMessage.displayName = "ChatMessage";

// 3. Memoized Input Area
const ChatInput = memo(({ 
  disabled, 
  onSend, 
  onImpersonate,
  onStopSpeak,
  isSpeakingAnywhere
}: { 
  disabled: boolean, 
  onSend: (val: string) => void, 
  onImpersonate: () => Promise<string | void>,
  onStopSpeak: () => void,
  isSpeakingAnywhere: boolean
}) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAction = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput("");
  };

  const handleImpersonateClick = async () => {
    const text = await onImpersonate();
    if (text) setInput(text);
  };

  return (
    <div className={styles.inputArea}>
      <div className={styles.toolCluster}>
        <button className={styles.toolButton} onClick={handleImpersonateClick} disabled={disabled} title="Impersonate User">
          <Wand2 size={20} />
        </button>
        {isSpeakingAnywhere ? (
          <button className={styles.toolButton} onClick={onStopSpeak} style={{ color: '#f87171' }} title="Stop Audio">
            <Loader2 className="spin" size={20} />
          </button>
        ) : (
          <button className={styles.toolButton} title="Audio Oracle">
            <Volume2 size={20} />
          </button>
        )}
      </div>
      
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={disabled ? "Generating..." : "Type your story... (use * for actions)"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleAction())}
          rows={1}
          disabled={disabled}
        />
        <button className={styles.sendButton} onClick={handleAction} disabled={disabled || !input.trim()}>
          <Send size={20} className={disabled ? "spin" : ""} />
        </button>
      </div>
    </div>
  );
});
ChatInput.displayName = "ChatInput";

const DEFAULT_CHARACTERS: Record<string, any> = {
  "barnaby": { name: "Barnaby", first_mes: "Welcome, traveller! You look like you've seen a few dusty roads today. Rest your boots by the fire.", image: "/characters/barnaby.png" },
  "elara": { name: "Elara", first_mes: "*She looks up from an old map.* Oh, fascinating timing. Are you also following the ley lines?", image: "/characters/elara.png" }
};

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showNotification } = useNotification();
  const [character, setCharacter] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllers = useRef<Record<number, AbortController>>({});
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const replaceMacros = (text: string, charName: string) => {
    if (!text) return "";
    const settings = getTavernSettings();
    
    return text
      .replaceAll("{{char}}", charName)
      .replaceAll("{{user}}", settings.userName || "Traveller")
      .replaceAll("<START>", "");
  };

  useEffect(() => {
    const loadSessionConfigs = async () => {
      await syncSettings();
      
      // 1. Locate the Active Session directly from the Database
      const activeSession = await tavernDB.get<any>("sessions", id);

      if (activeSession) {
        // 2. Retrieve the Character Template for this session from the Database
        const charId = activeSession.charId;
        const template = await tavernDB.get<any>("templates", `session-template-${id}`) || 
                          await tavernDB.get<any>("library", charId) || 
                          DEFAULT_CHARACTERS[charId];
        
        if (template) {
          setCharacter(template);
        }

        // 3. Load the specific Chat History from the Database (Chats store)
        const savedChat = await tavernDB.get<Message[]>("chats", id);
        if (savedChat) {
          setMessages(savedChat);
        } else {
          const greeting = activeSession.lastMessage || template?.first_mes || template?.firstMessage;
          const initialMessages: Message[] = [
            { sender: "System", content: `*A new conversation with ${activeSession.name} begins.*`, type: "narrator" },
            { sender: activeSession.name, content: replaceMacros(greeting, activeSession.name), type: "character", avatar: activeSession.image }
          ];
          setMessages(initialMessages);
          await tavernDB.set("chats", id, initialMessages);
        }
      }
    };
    loadSessionConfigs();
  }, [id]);

  useEffect(() => {
    const saveChat = async () => {
      if (id && messages.length > 0) {
        // A. Save chat history into the storage
        await tavernDB.set("chats", id, messages);
        
        // B. Save session details into the Sessions store
        const session = await tavernDB.get<any>("sessions", id);
        if (session) {
          const lastMsg = messages[messages.length - 1];
          await tavernDB.set("sessions", id, {
            ...session,
            lastMessage: lastMsg.content,
            timestamp: Date.now()
          });
        }
      }
    };
    saveChat();
  }, [messages, id]);

  const handleGenerateImage = async (index: number) => {
    const msg = messages[index];
    if (!msg || msg.isGeneratingImage) return;

    // Load full settings for workflows
    const config = await syncSettings();
    const settings = config.settings;
    const { workflows, defaultWorkflowId } = config;

    if (!settings.enableImageGen || !settings.comfyUrl) {
      showNotification("Image Generation is not enabled.", "error");
      return;
    }

    const workflow = workflows.find((w: any) => w.id === defaultWorkflowId) || workflows[0];
    if (!workflow) {
      showNotification("No Generation Template (Workflow) found.", "error");
      return;
    }

    // Mark as generating immediately
    const controller = new AbortController();
    abortControllers.current[index] = controller;
    
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, isGeneratingImage: true } : m));

    try {
      const charDescription = character.description || character.desc || "";
      const charPersonality = character.personality || "";
      
      // 1.5. Ensure consistent visual profile exists
      const appearanceProfileKey = `tavern-appearance-profile-${character.id || character.name}`;
      let appearanceProfile = await tavernDB.get<string>("templates", appearanceProfileKey);

      
      if (!appearanceProfile) {
        const idRequest = {
          messages: [
            { role: "system", content: "You are a master character designer. Convert the provided character details into a consistent physical description (facial features, hair style/color, eye shape/color, unique marks). This description MUST be used as a stable 'Appearance Profile' for all future character images. Be extremely specific but unchanging. Output around 40-60 words." },
            { role: "user", content: `Character Details: ${charDescription}\nName: ${character.name}` }
          ],
          settings: settings,
          modelId: settings.modelId || "glm-5",
          options: { max_tokens: 150 }
        };
        const idResp = await fetch(`/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(idRequest) });
        if (idResp.ok) {
          const idData = await idResp.json();
          appearanceProfile = idData.choices[0].text.trim();
          if (appearanceProfile) {
            await tavernDB.set("templates", appearanceProfileKey, appearanceProfile);
          }
        }
      }
      
      // Fallback: If the profile is still missing, create a basic description from profile
      if (!appearanceProfile) {
        appearanceProfile = charDescription.substring(0, 200) || character.name;
      }

      // Siphon context
      const sceneSummary = messages
        .slice(Math.max(0, index - 5), index)
        .map(m => `${m.sender}: ${m.content}`)
        .join("\n");
      
      const imagePromptRequest = {
        messages: [
          { 
            role: "system", 
            content: `You are a professional prompt engineer. Your task is to generate a high-quality, long-form natural language image prompt (100-150 words) that describes the physical details of a character and scene.

STRUCTURE (Follow strictly):
[Shot/Composition] + [Subject: ${appearanceProfile}] + [Action] + [Clothing/Details] + [Environment/Background] + [Lighting & Mood] + [Style/Medium] + [Exclusions].

CRITICAL DIRECTIVES:
- DIRECTIVE 1: You MUST Use the provided 'Appearance Profile' for the Subject & Appearance to ensure character consistency.
- DIRECTIVE 2: Determine its ERA and describe attire/environment with historical and visual accuracy. 
- DIRECTIVE 3: Describe materials and textures (linen, leather, silk). 
- DIRECTIVE 4: Describe the environment in detail.
- DIRECTIVE 5: Style should be 'Realistic Photography' or 'Painterly Masterpiece'.

Output ONLY the generated prompt.` 
          },
          { role: "user", content: `Appearance Profile: ${appearanceProfile}\n\nRelevant Context:\n${sceneSummary}\n\nTarget Message to Generate: ${msg.content}` }
        ],
        settings: settings,
        modelId: settings.modelId || "glm-5",
        options: { max_tokens: 150, temperature: 0.7 }
      };

      const promptResponse = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imagePromptRequest),
        signal: controller.signal
      });

      if (!promptResponse.ok) {
        const errorData = await promptResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "AI Provider failed to generate prompt.");
      }
      const promptData = await promptResponse.json();
      let curatedPrompt = promptData.choices?.[0]?.text?.trim()?.replace(/^Prompt: /i, "");
      
      if (!curatedPrompt) {
        curatedPrompt = appearanceProfile;
      }
      


      // 2. Prepare ComfyUI Workflow
      const promptBase = `masterpiece, best quality, ultra highres, ${curatedPrompt}`;
      let workflowJson = JSON.parse(workflow.json);

      // Identify text nodes (CLIPTextEncode) and apply the generated description
      for (const key in workflowJson) {
        if (workflowJson[key].class_type === "CLIPTextEncode") {
          const node = workflowJson[key];
          // Heuristic: Skip if it looks like a negative prompt node
          const text = node.inputs?.text?.toLowerCase() || "";
          if (text.includes("low quality") || text.includes("bad anatomy") || text.includes("negative")) {
            continue;
          }
          node.inputs.text = promptBase;
        }
      }



      // 2. Prompt ComfyUI
      const response = await fetch(`/api/comfy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: settings.comfyUrl, payload: { prompt: workflowJson } }),
        signal: controller.signal
      });

      if (!response.ok) {
        showNotification("Image Generation link failed.", "error");
        setMessages(prev => prev.map((m, i) => i === index ? { ...m, isGeneratingImage: false } : m));
        return;
      }
      const { prompt_id } = await response.json();

      // 3. Poll for result
      let imageUrl = "";
      for (let i = 0; i < 30; i++) { // 60 seconds max
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

        // Check for cancellation between polls
        if (!abortControllers.current[index]) break;
      }

      if (imageUrl) {
        setMessages(prev => prev.map((m, i) => i === index ? { ...m, imageUrl, isGeneratingImage: false } : m));
      } else {
        throw new Error("Generation timed out.");
      }

    } catch (e: any) {
      if (e.name === "AbortError") {
        showNotification("Generation cancelled.", "info");
      } else {
        showNotification("Image generation failed. Ensure ComfyUI is active.", "error");
      }
      setMessages(prev => prev.map((m, i) => i === index ? { ...m, isGeneratingImage: false } : m));
    } finally {
      delete abortControllers.current[index];
    }
  };

  const handleCancelGenerateImage = useCallback((index: number) => {
    // 1. Abort the actual fetch calls if they exist
    if (abortControllers.current[index]) {
      abortControllers.current[index].abort();
      delete abortControllers.current[index];
    }
    // 2. Immediately clear the UI state regardless of controller existence
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, isGeneratingImage: false } : m));
    showNotification("Generation cancelled.", "info");
  }, []);

  const handleImpersonate = async () => {
    if (!character || isTyping) return;
    
    setIsTyping(true);
    setIsImpersonating(true);
    try {
      const settings = getTavernSettings();
      
      const chatMessages = buildChatMessages({
        name: character.name,
        desc: character.description || character.desc,
        personality: character.personality,
        scenario: character.scenario,
        mes_example: character.mes_example,
        userName: settings.userName,
        userPersona: settings.userPersona
      }, messages);

      // Instruct the spirit to echo the user
      chatMessages.push({ 
        role: "system", 
        content: `[Task: Write exactly one response from the perspective of ${settings.userName || "{{user}}"}. Stay in character as a traveller in this setting. Do not write for ${character.name}.]` 
      });

      const response = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatMessages,
          settings: settings,
          modelId: settings.modelId || "glm-5",
          options: { max_tokens: 300, stop: ["\nYou:", "\nUser:", "###", `\n${character.name}:`] }
        })
      });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices[0].text.trim();
          return text;
        }
      } catch (error) {
  
        showNotification("The AI failed to generate a response.", "error");
      } finally {
      setIsTyping(false);
      setIsImpersonating(false);
    }
    return "";
  };

  const handleSend = async () => {
    if (!input.trim() || !character) return;
    
    // 1. Get settings and construct prompt
    const settings = getTavernSettings();
    
    const newMessage: Message = { 
      sender: settings.userName || "You", 
      content: input, 
      type: "user",
      avatar: settings.userImage
    };
    
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      // 2. Build the high-fidelity Chat Manifestation (Messages Array)
      const chatMessages = buildChatMessages({
        name: character.name,
        desc: character.description || character.desc,
        personality: character.personality,
        scenario: character.scenario,
        mes_example: character.mes_example,
        userName: settings.userName,
        userPersona: settings.userPersona
      }, updatedMessages);

      // 3. Generate response through the proxy
      const response = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatMessages,
          settings: settings,
          modelId: settings.modelId || "glm-5",
          options: {
            max_tokens: 800,
            stop: ["\nYou:", "\nUser:", "###", `\n${character.name}:`]
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();

        setIsTyping(false);
        return;
      }

      const data = await response.json();
      const rawText = data.choices[0].text.trim();
      
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        sender: character.name, 
        content: rawText, 
        type: "character", 
        avatar: character.image 
      }]);

    } catch (error) {

      setIsTyping(false);
      setMessages(prev => [...prev, { 
        sender: "System", 
        content: "*The connection to the character has been lost. (Check your AI Provider settings & ensure the host is active.)*", 
        type: "narrator" 
      }]);
    }
  };
  

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const handleSpeak = async (text: string) => {
    const settings = getTavernSettings();
    
    if (["Kokoro", "CosyVoice", "XTTSv2", "index-tts"].includes(settings.ttsProvider) && settings.kokoroUrl) {
      try {
        const response = await fetch(`${settings.kokoroUrl}/audio/speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: text,
            voice: settings.kokoroVoice || "af_sky",
            model: settings.ttsProvider.toLowerCase(),
            response_format: "mp3"
          })
        });
        
          if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;
            setIsSpeaking(true);
            audio.onended = () => {
              setIsSpeaking(false);
              currentAudioRef.current = null;
            };
            audio.play();
            return;
          }
        } catch (e) {
          setIsSpeaking(false);
        }
      }
  
      // High-Fidelity Fallback: Browser WebSpeech Oracle
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    };
  
    const stopSpeak = useCallback(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
        currentAudioRef.current = null;
      }
      setIsSpeaking(false);
    }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const currentSettings = getTavernSettings();
  const currentUserName = currentSettings.userName || "Traveller";
  const currentUserImage = currentSettings.userImage || "/characters/mystery.png";

  const handleGenerateImageCallback = useCallback((index: number) => handleGenerateImage(index), [handleGenerateImage]);
  const handleSpeakCallback = useCallback((text: string) => handleSpeak(text), [handleSpeak]);
  const handleStopSpeakCallback = useCallback(() => stopSpeak(), [stopSpeak]);
  const handleCancelGenerateImageCallback = useCallback((index: number) => handleCancelGenerateImage(index), [handleCancelGenerateImage]);

  const messageList = useMemo(() => messages.map((msg, index) => {
    const isUser = msg.type === "user" || msg.sender === currentUserName || msg.sender === "You";
    return (
      <ChatMessage 
        key={index}
        index={index}
        msg={msg}
        isUser={isUser}
        currentUserImage={currentUserImage}
        onGenerateImage={handleGenerateImageCallback}
        onCancelGenerateImage={handleCancelGenerateImageCallback}
        onSpeak={handleSpeakCallback}
        onStopSpeak={handleStopSpeakCallback}
        isSpeakingAnywhere={isSpeaking}
      />
    );
  }), [messages, currentUserName, currentUserImage, handleGenerateImageCallback, handleCancelGenerateImageCallback, handleSpeakCallback, handleStopSpeakCallback, isSpeaking]);

  const handleImpersonateCallback = useCallback(() => handleImpersonate(), [handleImpersonate]);
  const handleSendCallback = useCallback((val: string) => {
    handleSendWithVal(val);
  }, [messages, character]); 

  // Re-define handleSend to accept value
  const handleSendWithVal = async (val: string) => {
    if (!val.trim() || !character) return;
    const settings = getTavernSettings();
    const newMessage: Message = { sender: settings.userName || "You", content: val, type: "user", avatar: settings.userImage };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setIsTyping(true);
    try {
      const chatMessages = buildChatMessages({ name: character.name, desc: character.description || character.desc, personality: character.personality, scenario: character.scenario, mes_example: character.mes_example, userName: settings.userName, userPersona: settings.userPersona }, updatedMessages);
      const response = await fetch(`/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: chatMessages, settings, modelId: settings.modelId || "glm-5", options: { max_tokens: 800, stop: ["\nYou:", "\nUser:", "###", `\n${character.name}:`] } }) });
      if (!response.ok) { setIsTyping(false); return; }
      const data = await response.json();
      const rawText = data.choices[0].text.trim();
      setIsTyping(false);
      setMessages(prev => [...prev, { sender: character.name, content: rawText, type: "character", avatar: character.image }]);
    } catch (error) {
      setIsTyping(false);
      setMessages(prev => [...prev, { sender: "System", content: "*The connection was lost...*", type: "narrator" }]);
    }
  };

  return (
    <div className={`${styles.chatContainer} animate-entrance`}>
      <div className={styles.messages}>
        {messageList}

        {isTyping && character && (
          <div className={styles.narrator} style={{ opacity: 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 className="spin" size={14} />
            {isImpersonating ? `${currentUserName} is choosing words...` : `${character.name} is choosing words...`}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput 
        disabled={isTyping} 
        onSend={handleSendCallback} 
        onImpersonate={handleImpersonateCallback}
        onStopSpeak={handleStopSpeakCallback}
        isSpeakingAnywhere={isSpeaking}
      />
    </div>
  );
}
