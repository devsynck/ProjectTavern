/**
 * Tavern / SillyTavern Character Card Parser
 * Extracts V1/V2 metadata from the 'chara' chunk of a PNG file.
 */

export async function parseCharacterPNG(file: File): Promise<any | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const view = new DataView(buffer);
        let offset = 8; // Skip PNG header
        
        while (offset < view.byteLength) {
          const length = view.getUint32(offset);
          const type = String.fromCharCode(
            view.getUint8(offset + 4),
            view.getUint8(offset + 5),
            view.getUint8(offset + 6),
            view.getUint8(offset + 7)
          );
          
          if (type === "tEXt" || type === "iTXt" || type === "chara") {
             const chunkData = new Uint8Array(buffer, offset + 8, length);
             const text = new TextDecoder().decode(chunkData);
             
             if (type === "chara") {
                const decoded = atob(text.trim());
                resolve(JSON.parse(decoded));
                return;
             }
             
             // SillyTavern style: keywords are before the first null byte
             const nullIndex = chunkData.indexOf(0);
             if (nullIndex === -1) continue;
             
             const keyword = text.slice(0, nullIndex);
             
             if (keyword === "chara" || keyword === "ccv3") {
                // Find where the actual content starts (after null-terminated strings)
                // For iTXt, it's more complex, but tEXt is straightforward
                const base64Part = text.slice(nullIndex + 1);
                try {
                  const decoded = atob(base64Part.trim().replace(/\0/g, ''));
                  resolve(JSON.parse(decoded));
                  return;
                } catch (e) {
                  // Some cards might have raw JSON in tEXt (rare)
                  try {
                    resolve(JSON.parse(base64Part.trim().replace(/\0/g, '')));
                    return;
                  } catch (err) {}
                }
             }
          }
          offset += length + 12;
        }
        resolve(null);
      } catch (e) {
        console.error("The manifestation scroll is unreadable.", e);
        resolve(null);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
}

export function extractCharacterData(json: any) {
  const data = json.data || json;
  return {
    name: data.name || "Nameless Companion",
    desc: data.description || "",
    personality: data.personality || "",
    first_mes: data.first_mes || data.firstMessage || "",
    scenario: data.scenario || "",
    mes_example: data.mes_example || "",
    alternate_greetings: data.alternate_greetings || [],
    tags: data.tags || [],
    creator_notes: data.creator_notes || "",
    system_prompt: data.system_prompt || "",
    post_history_instructions: data.post_history_instructions || "",
    creator: data.creator || "Anonymous",
    character_version: data.character_version || "1.0"
  };
}
