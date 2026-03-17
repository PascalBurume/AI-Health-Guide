import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// POST /api/sessions/[id]/report/translate/tts → TTS for translated report text
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const upstream = await proxyRequest(
    `/api/v1/sessions/${params.id}/report/translate/tts`,
    req
  );

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({ detail: "TTS failed" }));
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "audio/mpeg",
      "Transfer-Encoding": "chunked",
    },
  });
}
