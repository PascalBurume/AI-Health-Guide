import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

// GET /api/sessions/[id]/report/tts → stream MP3 audio from FastAPI
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const upstream = await proxyRequest(`/api/v1/sessions/${params.id}/report/tts`, req);

  // Stream the audio back directly — do NOT buffer the full MP3 in memory
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "audio/mpeg",
      "Transfer-Encoding": "chunked",
    },
  });
}
