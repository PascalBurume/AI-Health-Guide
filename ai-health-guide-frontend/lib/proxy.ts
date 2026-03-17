/**
 * Shared helper: proxy a request body to the FastAPI backend and return the response.
 * All path components after /api/ are forwarded verbatim with the same method/body/headers.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function proxyRequest(
  path: string,
  req: Request,
  init?: RequestInit
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`;

  // Forward relevant headers — but strip Next.js internal / host headers
  const forwardHeaders = new Headers();
  for (const [key, value] of Array.from(req.headers.entries())) {
    if (["host", "connection", "transfer-encoding"].includes(key.toLowerCase())) continue;
    forwardHeaders.set(key, value);
  }

  const upstream = await fetch(url, {
    method: req.method,
    headers: forwardHeaders,
    body: init?.body ?? (req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined),
    // @ts-expect-error — Node 18+ fetch supports duplex for streaming request bodies
    duplex: "half",
    ...init,
  });

  return upstream;
}
