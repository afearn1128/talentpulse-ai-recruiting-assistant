import type { ChatMessage } from "./types";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * Runs a chat completion against Llama 3.3 on Workers AI.
 */
export async function runChat(
  ai: Ai,
  systemPrompt: string,
  messages: ChatMessage[]
  ): Promise<string> {
  const response = await ai.run(MODEL, {
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 1024,
  });

// Workers AI chat responses expose the text on `.response`
// (shape can vary slightly by model; this handles the common case).
const text = (response as { response?: string }).response;
  return text?.trim() ?? "";
}

/**
 * Asks the model to extract structured candidate fields from the
 * conversation so far. Returns a best-effort JSON object; callers
 * should treat missing/invalid fields defensively.
 */
export async function extractProfileUpdate(
  ai: Ai,
  messages: ChatMessage[]
  ): Promise<Record<string, unknown>> {
  const systemPrompt = `You extract structured candidate information from a recruiting chat.
  Read the conversation and return ONLY a JSON object (no prose, no markdown fences) with any of these
  fields you can confidently infer: name, currentRole, yearsExperience (number), keySkills (string array),
  targetRole, notes (short string). Omit fields you cannot infer. If nothing new can be inferred, return {}.`;

const raw = await runChat(ai, systemPrompt, messages);

try {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
} catch {
  return {};
}
}
