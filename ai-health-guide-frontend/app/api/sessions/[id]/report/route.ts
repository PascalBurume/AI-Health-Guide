import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// GET /api/sessions/[id]/report → return final reports JSON
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const upstream = await proxyRequest(`/api/v1/sessions/${params.id}/report`, req);
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
