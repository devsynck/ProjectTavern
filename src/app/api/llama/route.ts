import { NextRequest, NextResponse } from "next/server";
import { llamaManager } from "@/server/llama-manager";

export async function GET() {
  return NextResponse.json({ 
    status: llamaManager.getStatus(),
  });
}

export async function POST(req: NextRequest) {
  const { exePath, modelPath, args } = await req.json();
  
  if (!exePath || !modelPath) {
    return NextResponse.json({ error: "Missing paths" }, { status: 400 });
  }

  const argList = args ? args.split(" ") : [];
  const success = await llamaManager.startServer(exePath, modelPath, argList);

  return NextResponse.json({ success });
}

export async function DELETE() {
  llamaManager.stopServer();
  return NextResponse.json({ success: true });
}
