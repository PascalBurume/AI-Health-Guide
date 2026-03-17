import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// POST /api/sessions/[id]/report/translate → translate report to target language
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const upstream = await proxyRequest(
    `/api/v1/sessions/${params.id}/report/translate`,
    req
  );
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
