import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// PATCH /api/sessions/[id]/language → update session language
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const upstream = await proxyRequest(
    `/api/v1/sessions/${params.id}/language`,
    req,
    { method: "PATCH" }
  );
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
