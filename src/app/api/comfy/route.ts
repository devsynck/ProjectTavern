import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url, payload } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "ComfyUI Node URL missing." }, { status: 400 });
    }

    // High-Fidelity Proxy Handshake: Channeling the payload to the local ComfyUI nodes
    const response = await fetch(`${url}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Manifestation Link Fracture: ${response.status}`, details: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {

    return NextResponse.json({ error: "Failed to bridge to ComfyUI nodes. Ensure the engine is active." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const url = searchParams.get("url");
    const path = searchParams.get("path");

    if (!url || !path) {
      return NextResponse.json({ error: "ComfyUI Bridge metadata missing." }, { status: 400 });
    }

    // High-Fidelity Siphoning: Retrieving history or visual data from ComfyUI
    const response = await fetch(`${url}${path}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Manifestation Siphon Fracture: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {

    return NextResponse.json({ error: "Neural Rift Error during data siphoning." }, { status: 500 });
  }
}
