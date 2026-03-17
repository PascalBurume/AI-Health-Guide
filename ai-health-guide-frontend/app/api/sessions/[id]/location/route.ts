import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// POST /api/sessions/[id]/location → submit GPS coordinates
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const upstream = await proxyRequest(`/api/v1/sessions/${params.id}/location`, req);
    const text = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { detail: text }; }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("[location proxy]", err);
    return NextResponse.json({ detail: "Failed to contact backend" }, { status: 502 });
  }
}
