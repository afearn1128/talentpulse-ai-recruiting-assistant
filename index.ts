import type { Env } from "./types";

export { ConversationMemory } from "./conversationMemory";
export { ScreeningWorkflow } from "./screeningWorkflow";

function getOrCreateConversationId(request: Request): { id: string; setCookie?: string } {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(/conversationId=([a-zA-Z0-9-]+)/);
  if (match) return { id: match[1] };

  const id = crypto.randomUUID();
  return { id, setCookie: `conversationId=${id}; Path=/; HttpOnly; SameSite=Lax` };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
