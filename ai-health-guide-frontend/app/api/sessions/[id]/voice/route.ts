import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// POST /api/sessions/[id]/voice → upload audio (multipart) and transcribe
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const upstream = await proxyRequest(`/api/v1/sessions/${params.id}/voice`, req);
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
