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

Have you had a chance to create src/llm.ts with the content I gave you? Once that's done, I'll send you the next one right away.can you provide the link to access the Github at the add file locationConstructed GitHub file creation URL with pre-filled filenameConstructed GitHub file creation URL with pre-filled filenameHere's a direct link that opens GitHub with a new file ready to go, pre-filled with the right path:
For src/llm.ts:
https://github.com/afearn1128/talentpulse-ai-recruiting-assistant/new/main?filename=src/llm.ts
Click that link — it'll drop you straight into the "Create new file" editor with src/llm.ts already in the filename box. Just paste the content I gave you earlier into the big text area, scroll down, and click Commit changes... → Commit changes.
If you're not sure whether you already added this one, you can check first by going to: https://github.com/afearn1128/talentpulse-ai-recruiting-assistant/tree/main/src — if llm.ts is listed there already, skip ahead and let me know so I can send you the next file.
