import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { Env, ScreeningWorkflowParams, ScreeningResult, ChatMessage, ConversationState } from "./types";
import { runChat } from "./llm";

export class ScreeningWorkflow extends WorkflowEntrypoint<Env, ScreeningWorkflowParams> {
  async run(event: WorkflowEvent<ScreeningWorkflowParams>, step: WorkflowStep): Promise<ScreeningResult> {
    const { conversationId, jobDescription } = event.payload;

    const conversation = await step.do("fetch-conversation", async () => {
      const id = this.env.CONVERSATION_MEMORY.idFromName(conversationId);
      const stub = this.env.CONVERSATION_MEMORY.get(id);
      const res = await stub.fetch("https://do/history");
      return (await res.json()) as ConversationState;
    });

    const candidateSummary = await step.do("summarize-candidate", async () => {
      return runChat(
        this.env.AI,
        "Summarize this recruiting chat transcript into a 3-5 sentence candidate summary for a hiring manager. Be factual, no fluff.",
        conversation.messages
      );
    });

    const scoring = await step.do("score-fit", async () => {
      const prompt: ChatMessage[] = [
        {
          role: "user",
          content: `Job description:\n${jobDescription}\n\nCandidate summary:\n${candidateSummary}\n\nRate fit from 1-10 and give a 2-3 sentence rationale. Respond ONLY as JSON: {"score": number, "rationale": string}`,
        },
      ];
      const raw = await runChat(this.env.AI, "You are an expert technical recruiter scoring candidate fit.", prompt);
      try {
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as { score: number; rationale: string };
        return parsed;
      } catch {
        return { score: 0, rationale: "Could not parse scoring output." };
      }
    });

    const recruiterBrief = await step.do("generate-recruiter-brief", async () => {
      const prompt: ChatMessage[] = [
        {
          role: "user",
          content: `Write a short, well-formatted recruiter brief combining this candidate summary and fit score into a document a recruiter could paste into an ATS note.\n\nCandidate summary: ${candidateSummary}\n\nFit score: ${scoring.score}/10\nRationale: ${scoring.rationale}`,
        },
      ];
      return runChat(this.env.AI, "You write concise, professional recruiter briefs.", prompt);
    });

    return {
      candidateSummary,
      fitScore: scoring.score,
      fitRationale: scoring.rationale,
      recruiterBrief,
    };
  }
}
