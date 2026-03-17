import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// POST /api/sessions → create new session
export async function POST(req: NextRequest) {
  const upstream = await proxyRequest("/api/v1/sessions", req, { method: "POST" });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
