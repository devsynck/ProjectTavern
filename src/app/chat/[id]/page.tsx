"use client";

import { useState, useRef, useEffect, use } from "react";
import Image from "next/image";
import { Send, Image as ImageIcon, Volume2, Wand2, Plus, Sparkles, Bot } from "lucide-react";
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
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, isGeneratingImage: true } : m));

    try {
      const charDescription = character.description || character.desc || "";
      const charPersonality = character.personality || "";
      
      // 1.5. Ensure consistent visual profile exists
      const visualProfileKey = `tavern-visual-profile-${character.id || character.name}`;
      let visualProfile = await tavernDB.get<string>("templates", visualProfileKey);

      
      if (!visualProfile) {

        const idRequest = {
          messages: [
            { role: "system", content: "You are a master character designer. Convert the provided character details into a consistent physical description (facial features, hair style/color, eye shape/color, unique marks). This description MUST be used as a stable 'Visual Profile' for all future character images. Be extremely specific but unchanging. Output around 40-60 words." },
            { role: "user", content: `Character Details: ${charDescription}\nName: ${character.name}` }
          ],
          settings: settings,
          modelId: settings.modelId || "glm-5",
          options: { max_tokens: 150 }
        };
        const idResp = await fetch(`/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(idRequest) });
        if (idResp.ok) {
          const idData = await idResp.json();
          visualProfile = idData.choices[0].text.trim();
          if (visualProfile) {
            await tavernDB.set("templates", visualProfileKey, visualProfile);
          }
        }
      }
      
      // Fallback: If the profile is still missing, create a basic description from profile
      if (!visualProfile) {

        visualProfile = charDescription.substring(0, 200) || character.name;
      }

      // Siphon context
      const sceneSummary = messages
        .slice(Math.max(0, index - 5), index)
        .map(m => `${m.sender}: ${m.content}`)
        .join("\n");
      
      const promptManifestRequest = {
        messages: [
          { 
            role: "system", 
            content: `You are a master director and visual style architect for the Z-IMAGE-TURBO engine. Your task is to generate a high-quality, long-form natural language image prompt (100-150 words) that describes the visual details of a character and scene.

STRUCTURE (Follow strictly):
[Shot/Composition] + [Subject: ${visualProfile}] + [Action] + [Clothing/Details] + [Environment/Background] + [Lighting & Mood] + [Style/Medium] + [Exclusions].

CRITICAL DIRECTIVES:
- DIRECTIVE 1: You MUST Use the provided 'Visual Profile' for the Subject & Appearance to ensure character consistency.
- DIRECTIVE 2: Determine its ERA and describe attire/environment with historical and visual accuracy. 
- DIRECTIVE 3: Describe materials and textures (linen, leather, silk). 
- DIRECTIVE 4: Describe the environment in detail.
- DIRECTIVE 5: Style should be 'Realistic Photography' or 'Painterly Masterpiece'.

Output ONLY the generated prompt.` 
          },
          { role: "user", content: `Visual Profile: ${visualProfile}\n\nRelevant Context:\n${sceneSummary}\n\nTarget Message to Generate: ${msg.content}` }
        ],
        settings: settings,
        modelId: settings.modelId || "glm-5",
        options: { max_tokens: 150, temperature: 0.7 }
      };

      const promptResponse = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptManifestRequest)
      });

      if (!promptResponse.ok) {
        const errorData = await promptResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "AI Provider failed to generate prompt.");
      }
      const promptData = await promptResponse.json();
      let curatedPrompt = promptData.choices?.[0]?.text?.trim()?.replace(/^Prompt: /i, "");
      
      if (!curatedPrompt) {

        curatedPrompt = visualProfile;
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
        body: JSON.stringify({ url: settings.comfyUrl, payload: { prompt: workflowJson } })
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
      }

      if (imageUrl) {
        setMessages(prev => prev.map((m, i) => i === index ? { ...m, imageUrl, isGeneratingImage: false } : m));
        showNotification("Image generation complete.", "success");
      } else {
        throw new Error("Generation timed out.");
      }

    } catch (e) {

      showNotification("Image generation failed. Ensure ComfyUI is active.", "error");
      setMessages(prev => prev.map((m, i) => i === index ? { ...m, isGeneratingImage: false } : m));
    }
  };

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
          setInput(text);
          showNotification("User response generated.", "success");
        }
      } catch (error) {
  
        showNotification("The AI failed to generate a response.", "error");
      } finally {
      setIsTyping(false);
      setIsImpersonating(false);
    }
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
    setInput("");
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
  
  const renderDynamicText = (text: string) => {
    if (!text) return null;

    const parts = text.split(/(\*.*?\*|".*?")/g);

    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith("*") && part.endsWith("*")) {
            return (
              <i 
                key={i} 
                style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}
              >
                {part.slice(1, -1)}
              </i>
            );
          } else if (part.startsWith('"') && part.endsWith('"')) {
            return (
              <b 
                key={i} 
                style={{ color: "#ffffff", fontWeight: 700 }}
              >
                {part}
              </b>
            );
          }
          return <span key={i} style={{ color: "#e0e0e0" }}>{part}</span>;
        })}
      </>
    );
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
          const blob = await response.json(); // Some Kokoro-FastAPI wrappers return JSON, others return direct audio.
          // Wait, the OpenAI spec says it returns the audio directly.
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play();
          return;
        }
      } catch (e) {

      }
    }

    // High-Fidelity Fallback: Browser WebSpeech Oracle
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const currentSettings = getTavernSettings();
  const currentUserName = currentSettings.userName || "Traveller";
  const currentUserImage = currentSettings.userImage || "/characters/mystery.png";

  return (
    <div className={`${styles.chatContainer} animate-entrance`}>
      <div className={styles.messages}>
        {messages.map((msg, index) => {
          const isUser = msg.type === "user" || msg.sender === currentUserName || msg.sender === "You";
          const displayType = isUser ? "user" : msg.type;

          return (
            <div key={index} className={styles.message}>
              {displayType === "narrator" ? (
                <p className={styles.narrator}>{renderDynamicText(msg.content)}</p>
              ) : (
                <div className={displayType === "user" ? styles.userWrapper : styles.charWrapper}>
                  {(msg.avatar || (displayType === "user" && currentUserImage)) && (
                    <div className={styles.avatarContainer}>
                      <Image src={msg.avatar || currentUserImage} alt={msg.sender} fill className={styles.avatar} />
                    </div>
                  )}
                  
                  <div className={styles.messageBody}>
                    <div className={styles.metadata}>
                      <span className={displayType === "user" ? styles.userName : styles.name} style={{ fontSize: '1.4rem' }}>
                        {msg.sender}
                      </span>
                    </div>
                    <div className={`${styles.content} ${displayType === "user" ? styles.userGlass : "obsidianParchment"}`}>
                      {renderDynamicText(msg.content)}
                    </div>

                    <div className={styles.messageAddons} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: displayType === "user" ? 'flex-end' : 'flex-end' }}>
                        <button 
                          className={styles.miniTool} 
                          onClick={() => handleGenerateImage(index)}
                          title="Manifest Visual Echo"
                          style={{ 
                            opacity: 0.4, transition: 'all 0.2s', background: 'transparent',
                            border: 'none', color: 'var(--accent-gold)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <ImageIcon size={14} />
                          <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Image</span>
                        </button>
                        <button 
                          className={styles.miniTool} 
                          onClick={() => handleSpeak(msg.content)}
                          title="Manifest Vocal Echo"
                          style={{ 
                            opacity: 0.4, transition: 'all 0.2s', background: 'transparent',
                            border: 'none', color: 'var(--accent-gold)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px'
                          }}
                        >
                          <Volume2 size={14} />
                          <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Speak</span>
                        </button>
                      </div>

                      {msg.isGeneratingImage && (
                        <div style={{ alignSelf: displayType === "user" ? 'flex-end' : 'flex-start', color: 'var(--accent-gold)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                          <Sparkles className="spin" size={14} /> <span>Generating image...</span>
                        </div>
                      )}

                      {msg.imageUrl && (
                        <div className={styles.inlineImageWrapper} style={{ alignSelf: displayType === "user" ? 'flex-end' : 'flex-start', width: '70%', maxWidth: '400px' }}>
                          <img src={msg.imageUrl} alt="Manifestation" style={{ width: '100%', borderRadius: '4px', border: '1px solid var(--glass-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                        </div>
                      )}
                    </div>
                  </div>


                </div>
              )}
            </div>
          );
        })}

        {isTyping && character && (
          <div className={styles.narrator} style={{ opacity: 0.5 }}>
            {isImpersonating ? `${currentUserName} is choosing words...` : `${character.name} is choosing words...`}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <div className={styles.toolCluster}>
          <button 
            className={styles.toolButton} 
            onClick={handleImpersonate} 
            disabled={isTyping}
            title="Impersonate (Echo User)"
          >
            <Wand2 size={20} />
          </button>
          <button className={styles.toolButton}>
            <Volume2 size={20} />
          </button>
        </div>
        
        <div className={styles.inputWrapper}>
          <textarea
            className={styles.textarea}
            placeholder={isTyping ? "Generating..." : "Type your story... (use * for actions)"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            rows={1}
            disabled={isTyping}
          />
          <button 
            className={styles.sendButton} 
            onClick={handleSend}
            disabled={isTyping || !input.trim()}
          >
            <Send size={20} className={isTyping ? "spin" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
