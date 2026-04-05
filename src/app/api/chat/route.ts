import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, settings, modelId, options } = await req.json();

    if (!messages || !(settings?.apiUrl || settings?.llamaUrl)) {
      return NextResponse.json({ error: "Chat messages or API link missing." }, { status: 400 });
    }

    let url = settings.apiUrl || settings.llamaUrl;
    if (url.endsWith("/")) url = url.slice(0, -1);
    
    const endpoint = url.includes("/v1") || url.includes("/v4") || url.includes("/v2")
      ? `${url}/chat/completions`
      : `${url}/v1/chat/completions`;

    // AI Provider Check
    const isZai = settings.inferenceProvider?.includes("Z.ai") || url.includes("z.ai");

    // Constructing Request Payload: Configuring request options
    const payload: any = {
      model: modelId || settings.modelId || "glm-5",
      messages: messages,
      temperature: options?.temperature || 0.7,
      stream: false
    };

    // Add provider-specific parameters to avoid format errors
    if (!isZai) {
      payload.max_tokens = options?.max_tokens || 800;
      payload.stop = options?.stop || ["You:", "###"];
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Language": "en-US,en"
    };

    if (settings.inferenceProvider === "OpenRouter" || url.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "http://localhost:3000";
      headers["X-Title"] = "Project Tavern";
    }

    if (settings.apiKey) {
      headers["Authorization"] = `Bearer ${settings.apiKey}`;
    }



    // Standard Tavern behavior uses /v1/chat/completions for modern roleplay
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      cache: "no-store", // Avoid caching API responses
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorText = await response.text();

      
      return NextResponse.json({ error: `API Response Error: ${response.status}`, details: errorText }, { status: response.status });
    }

    const data = await response.json();
    
    // Extract Response Content: Search for content in common OpenAI-compatible fields
    const text = data.choices?.[0]?.message?.content || 
                 data.choices?.[0]?.text || 
                 data.message?.content || 
                 "";
    
    if (!text.trim()) {

    } else {

    }

    return NextResponse.json({
      choices: [{ text: text.trim() }]
    });

  } catch (error: any) {

    return NextResponse.json({ error: error.message || "Failed to generate response." }, { status: 500 });
  }
}
