const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=60",
};

export const CORS = CORS_HEADERS;

export function sendJson(
  payload: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...headers,
    },
  });
}

export function sendOk(data: unknown): Response {
  return sendJson({ code: 200, status: "Ok", data }, 200, CACHE_HEADERS);
}

export function sendBadRequest(message: string): Response {
  return sendJson({ code: 400, status: "Bad Request", message }, 400);
}

export function sendNotFound(message: string): Response {
  return sendJson({ code: 404, status: "Not Found", message }, 404);
}

export function sendServerError(): Response {
  return sendJson({ code: 500, status: "Internal Server Error" }, 500);
}
export function parsePositiveInt(raw: string | null, fallback: number | null): number | null {
  if (raw === null) return fallback;

  const value = raw.trim();
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}
