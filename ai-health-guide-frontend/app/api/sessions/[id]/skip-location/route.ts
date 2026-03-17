import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// POST /api/sessions/[id]/skip-location → skip location and proceed to reports
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const upstream = await proxyRequest(
      `/api/v1/sessions/${params.id}/skip-location`,
      req
    );
    const text = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { detail: text }; }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("[skip-location proxy]", err);
    return NextResponse.json({ detail: "Failed to contact backend" }, { status: 502 });
  }
}
