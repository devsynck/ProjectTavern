import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url, payload } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "ComfyUI Node URL missing." }, { status: 400 });
    }

    // API Proxy Request: Sending the payload to the local ComfyUI instance
    const response = await fetch(`${url}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `ComfyUI Connection Error: ${response.status}`, details: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {

    return NextResponse.json({ error: "Failed to connect to ComfyUI instance. Ensure the server is running." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const url = searchParams.get("url");
    const path = searchParams.get("path");

    if (!url || !path) {
      return NextResponse.json({ error: "ComfyUI configuration parameters missing." }, { status: 400 });
    }

    // Fetching History: Retrieving history or image data from ComfyUI
    const response = await fetch(`${url}${path}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ error: `ComfyUI History Retrieval Error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {

    return NextResponse.json({ error: "Connection Error during data retrieval." }, { status: 500 });
  }
}
