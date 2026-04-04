import { NextRequest, NextResponse } from "next/server";

// High-Fidelity Models Proxy: Neutralizing CORS and siphoning unique identities safely.
export async function POST(req: NextRequest) {
  try {
    const { settings } = await req.json();

    if (!settings?.apiUrl) {
      return NextResponse.json({ error: "Missing API Vault URL." }, { status: 400 });
    }

    let url = settings.apiUrl;
    if (url.endsWith("/")) url = url.slice(0, -1);
    
    // Dynamic Model Path: Siphon the correct path based on provider structure
    const endpoint = url.includes("/v4") || url.includes("/v1") || url.includes("/v2")
      ? `${url}/models`
      : `${url}/v1/models`;

    const headers: Record<string, string> = {
      "Accept-Language": "en-US,en"
    };

    if (settings.inferenceProvider === "OpenRouter" || url.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "http://localhost:3000";
      headers["X-Title"] = "Multimodal Tavern";
    }

    if (settings.apiKey) {
      headers["Authorization"] = `Bearer ${settings.apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers,
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Oracle error: ${response.status}`, details: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Models Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
