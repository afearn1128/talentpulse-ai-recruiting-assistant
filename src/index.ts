import type { Env } from "./types";

export { ConversationMemory } from "./conversationMemory";
export { ScreeningWorkflow } from "./screeningWorkflow";

function unauthorized(): Response {
    return new Response("Authentication required.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="TalentPulse", charset="UTF-8"' },
    });
}

/**
 * Gates the whole Worker behind a shared Basic Auth password.
 *
 * Fails closed: if AUTH_PASSWORD is unset, nothing is reachable, so a missing
 * secret cannot silently expose the AI endpoints.
 */
function isAuthorized(request: Request, env: Env): boolean {
    const expected = env.AUTH_PASSWORD;
    if (!expected) return false;

    const header = request.headers.get("Authorization");
    if (!header?.startsWith("Basic ")) return false;

    let decoded: string;
    try {
        decoded = atob(header.slice("Basic ".length));
    } catch {
        return false;
    }

    // Basic Auth sends "user:password"; the username is unused.
    const separator = decoded.indexOf(":");
    if (separator === -1) return false;

    const supplied = new TextEncoder().encode(decoded.slice(separator + 1));
    const secret = new TextEncoder().encode(expected);

    // timingSafeEqual throws unless both views are the same length.
    if (supplied.byteLength !== secret.byteLength) return false;
    return crypto.subtle.timingSafeEqual(supplied, secret);
}

function getOrCreateConversationId(request: Request): { id: string; setCookie?: string } {
    const cookie = request.headers.get("Cookie") ?? "";
    const match = cookie.match(/conversationId=([a-zA-Z0-9-]+)/);
    if (match) return { id: match[1] };

  const id = crypto.randomUUID();
    return { id, setCookie: `conversationId=${id}; Path=/; HttpOnly; SameSite=Lax` };
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
          if (!isAuthorized(request, env)) return unauthorized();

          const url = new URL(request.url);

      // --- POST /api/chat  { message: string } ---
      if (url.pathname === "/api/chat" && request.method === "POST") {
              const { id, setCookie } = getOrCreateConversationId(request);
              const { message } = await request.json<{ message: string }>();

            const doId = env.CONVERSATION_MEMORY.idFromName(id);
              const stub = env.CONVERSATION_MEMORY.get(doId);
              const res = await stub.fetch("https://do/message", {
                        method: "POST",
                        body: JSON.stringify({ message }),
                        headers: { "Content-Type": "application/json" },
              });

            const headers = new Headers(res.headers);
              if (setCookie) headers.set("Set-Cookie", setCookie);
              return new Response(res.body, { status: res.status, headers });
      }

      // --- GET /api/history ---
      if (url.pathname === "/api/history" && request.method === "GET") {
              const { id, setCookie } = getOrCreateConversationId(request);
              const doId = env.CONVERSATION_MEMORY.idFromName(id);
              const stub = env.CONVERSATION_MEMORY.get(doId);
              const res = await stub.fetch("https://do/history");
              const headers = new Headers(res.headers);
              if (setCookie) headers.set("Set-Cookie", setCookie);
              return new Response(res.body, { status: res.status, headers });
      }

      // --- POST /api/reset  (clears stored history + profile) ---
      if (url.pathname === "/api/reset" && request.method === "POST") {
              const { id, setCookie } = getOrCreateConversationId(request);
              const doId = env.CONVERSATION_MEMORY.idFromName(id);
              const stub = env.CONVERSATION_MEMORY.get(doId);
              const res = await stub.fetch("https://do/reset", { method: "POST" });
              const headers = new Headers(res.headers);
              if (setCookie) headers.set("Set-Cookie", setCookie);
              return new Response(res.body, { status: res.status, headers });
      }

      // --- POST /api/screen  { jobDescription: string } ---
      if (url.pathname === "/api/screen" && request.method === "POST") {
              const { id } = getOrCreateConversationId(request);
              const { jobDescription } = await request.json<{ jobDescription: string }>();

            const instance = await env.SCREENING_WORKFLOW.create({
                      params: { conversationId: id, jobDescription: jobDescription ?? "" },
            });

            return Response.json({ workflowInstanceId: instance.id });
      }

      // --- GET /api/screen/:instanceId/status ---
      const statusMatch = url.pathname.match(/^\/api\/screen\/([a-zA-Z0-9-]+)\/status$/);
          if (statusMatch && request.method === "GET") {
                  const instance = await env.SCREENING_WORKFLOW.get(statusMatch[1]);
                  const status = await instance.status();
                  return Response.json(status);
          }

      // --- Static chat UI ---
      return env.ASSETS.fetch(request);
    },
};
