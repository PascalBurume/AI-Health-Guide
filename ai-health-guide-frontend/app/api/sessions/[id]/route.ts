import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// GET /api/sessions/[id] → poll session state
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const upstream = await proxyRequest(`/api/v1/sessions/${params.id}`, req);
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
