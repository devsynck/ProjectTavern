export interface CharacterData {
  name: string;
  desc?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  userName?: string;
  userPersona?: string;
}

export interface Message {
  sender: string;
  content: string;
  type: "character" | "user" | "narrator";
}

/**
 * Modern Chat Completion Format (Messages Array)
 * Recommended for Llama 3, Gemma, Mistral, etc.
 */
export const buildChatMessages = (char: CharacterData, history: Message[]) => {
  const userName = char.userName || "{{user}}";
  
  const systemPrompt = `Roleplay as ${char.name}. Keep responses concise and in character. Use *asterisks* for actions and movements. Use "quotes" for speech.\n\n` +
    `Character: ${char.name}\n` +
    (char.desc ? `Description: ${char.desc}\n` : "") +
    (char.personality ? `Personality: ${char.personality}\n` : "") +
    (char.scenario ? `Scenario: ${char.scenario}\n` : "") +
    `--- \n` +
    `User Name: ${userName}\n` +
    (char.userPersona ? `User Persona: ${char.userPersona}\n` : "");

  const messages = [
    { role: "system", content: systemPrompt },
  ];

  // If there are examples, add them as a few-shot interaction
  if (char.mes_example) {
    messages.push({ role: "system", content: `Examples of ${char.name}'s speech:\n${char.mes_example}` });
  }

  history.forEach((msg) => {
    if (msg.type === "character") {
      messages.push({ role: "assistant", content: msg.content });
    } else {
      // Treat user and narrator as 'user' role
      const prefix = msg.type === "narrator" ? "[Narrative: " : "";
      const suffix = msg.type === "narrator" ? "]" : "";
      messages.push({ role: "user", content: `${prefix}${msg.content}${suffix}` });
    }
  });

  return messages;
};

/**
 * Legacy Completion Format (Single String)
 * Recommended for older models or specific Llama.cpp setups.
 */
export const buildTavernPrompt = (char: CharacterData, history: Message[]) => {
  const systemPrompt = `[System: Roleplay as ${char.name}. Keep responses concise and in character. Use *asterisks* for actions and movements. Use "quotes" for speech.]\n\n` +
    `Character: ${char.name}\n` +
    (char.desc ? `Description: ${char.desc}\n` : "") +
    (char.personality ? `Personality: ${char.personality}\n` : "") +
    (char.scenario ? `Scenario: ${char.scenario}\n` : "") +
    (char.mes_example ? `\nExamples:\n${char.mes_example}\n` : "") +
    `---`;

  const conversationHistory = history
    .map((msg) => {
      if (msg.type === "narrator") return `[Narrative: ${msg.content}]`;
      return `${msg.sender}: ${msg.content}`;
    })
    .join("\n");

  return `${systemPrompt}\n\n${conversationHistory}\n${char.name}: `;
};
