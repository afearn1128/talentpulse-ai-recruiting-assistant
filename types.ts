import type { ConversationMemory } from "./conversationMemory";
import type { ScreeningWorkflow } from "./screeningWorkflow";

export interface Env {
  AI: Ai;
  CONVERSATION_MEMORY: DurableObjectNamespace<ConversationMemory>;
  SCREENING_WORKFLOW: Workflow;
  ASSETS: Fetcher;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CandidateProfile {
  name?: string;
  currentRole?: string;
  yearsExperience?: number;
  keySkills?: string[];
  targetRole?: string;
  notes?: string;
}

export interface ConversationState {
  messages: ChatMessage[];
  profile: CandidateProfile;
}

export interface ScreeningWorkflowParams {
  conversationId: string;
  jobDescription: string;
}

export interface ScreeningResult {
  candidateSummary: string;
  fitScore: number;
  fitRationale: string;
  recruiterBrief: string;
}
