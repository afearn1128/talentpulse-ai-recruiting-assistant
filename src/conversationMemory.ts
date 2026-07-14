import { DurableObject } from "cloudflare:workers";
import type { Env, ConversationState, ChatMessage } from "./types";
import { runChat, extractProfileUpdate } from "./llm";

const SYSTEM_PROMPT = `You are TalentPulse, a friendly AI recruiting screener conducting an initial
candidate conversation. Ask concise, one-at-a-time questions to learn about the candidate's current
role, years of experience, key skills, and the type of role they're targeting next. Keep replies short
(2-4 sentences), warm, and professional. Do not make hiring decisions or promises about the role.`;

/**
 * One instance of this Durable Object is created per conversation ID,
 * giving each conversation its own isolated, persistent state
 * (message history + extracted candidate profile) that survives
 * across requests and Worker restarts.
 */
export class ConversationMemory extends DurableObject<Env> {
  async getState(): Promise<ConversationState> {
    const stored = await this.ctx.storage.get<ConversationState>("state");
    return stored ?? { messages: [], profile: {} };
  }

async saveState(state: ConversationState): Promise<void> {
  await this.ctx.storage.put("state", state);
}

/** Appends a user message, generates an assistant reply, and updates the candidate profile. */
async sendMessage(userMessage: string): Promise<ConversationState> {
  const state = await this.getState();

  const userTurn: ChatMessage = { role: "user", content: userMessage };
  const historyWithUser = [...state.messages, userTurn];

  const replyText = await runChat(this.env.AI, SYSTEM_PROMPT, historyWithUser);
  const assistantTurn: ChatMessage = { role: "assistant", content: replyText };

  const messages = [...historyWithUser, assistantTurn];

  // Best-effort structured extraction, layered onto the existing profile.
  const profileUpdate = await extractProfileUpdate(this.env.AI, messages);
  const profile = { ...state.profile, ...profileUpdate };

  const newState: ConversationState = { messages, profile };
  await this.saveState(newState);
  return newState;
}

async fetch(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname.endsWith("/message") && request.method === "POST") {
    const { message } = await request.json<{ message: string }>();
    if (!message || typeof message !== "string") {
      return Response.json({ error: "message is required" }, { status: 400 });
    }
    const state = await this.sendMessage(message);
    return Response.json(state);
  }

  if (url.pathname.endsWith("/history") && request.method === "GET") {
    const state = await this.getState();
    return Response.json(state);
  }

  return new Response("Not found", { status: 404 });
}
}
