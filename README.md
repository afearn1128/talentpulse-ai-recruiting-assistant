# TalentPulse — AI Recruiting Screening Assistant

An AI-powered application built on Cloudflare's developer platform, submitted for the Cloudflare
VP, Talent Acquisition and Strategy assignment. TalentPulse runs a lightweight AI screening
conversation with a candidate, then produces a structured recruiter brief (summary + job-fit score)
via a coordinated multi-step Workflow.

## How it meets the assignment requirements

| Requirement | Implementation |
|---|---|
| **LLM** | Llama 3.3 (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) on Workers AI — see `src/llm.ts` |
| **Workflow / coordination** | A Cloudflare Workflow (`src/screeningWorkflow.ts`) orchestrates fetch → summarize → score → brief as independently-retried steps, invoked from the Worker (`src/index.ts`) |
| **User input via chat** | Static chat UI (`public/`) served by the Worker, posting to `/api/chat` |
| **Memory / state** | A Durable Object (`src/conversationMemory.ts`), one instance per conversation, persists message history and an extracted candidate profile across requests |

## Architecture

```
Browser (chat UI)
      │
      ▼
Worker (src/index.ts)  ──POST /api/chat──▶  Durable Object (ConversationMemory)
      │                                          │  stores messages + profile
      │                                          │  calls Workers AI (Llama 3.3)
      │
      └──POST /api/screen──▶  Workflow (ScreeningWorkflow)
                                   │  step: fetch conversation from the DO
                                   │  step: summarize candidate (LLM)
                                   │  step: score fit vs. job description (LLM)
                                   │  step: generate recruiter brief (LLM)
```

## Project structure

```
talentpulse/
├── wrangler.toml            # Bindings: AI, Durable Object, Workflow, static assets
├── src/
│   ├── index.ts              # Worker entry: routes + serves the chat UI
│   ├── conversationMemory.ts # Durable Object: per-conversation memory/state
│   ├── screeningWorkflow.ts  # Workflow: multi-step screening pipeline
│   ├── llm.ts                # Workers AI call helpers (prompts live here)
│   └── types.ts              # Shared types
└── public/
    ├── index.html            # Chat UI
    ├── style.css
    └── chat.js                # Client-side chat + brief-generation logic
```

## Setup

```bash
npm install
npx wrangler login
```

## Local development

```bash
npm run dev
```

This starts a local server (via Miniflare) with Workers AI, Durable Objects, and Workflows
emulated locally. Open the printed local URL to use the chat UI.

## Deploy

```bash
npm run deploy
```

Wrangler will provision the Durable Object namespace and Workflow on first deploy per the
bindings in `wrangler.toml`. No extra API keys are required since Workers AI is billed and run
directly inside your Cloudflare account.

## Trying it out

1. Open the deployed URL and have a short back-and-forth with the assistant (e.g., "I'm a VP of
   Talent Acquisition with 15 years in enterprise HR, currently leading AI-first recruiting at a
   Fortune 500 financial company...").
2. Paste a job description into the right-hand panel and click **Generate Brief**.
3. The UI polls `/api/screen/:id/status` until the Workflow completes and displays the structured
   summary, fit score, and recruiter brief.

## Notes on scope

This is intentionally a focused, single-purpose build rather than a broad platform, to keep the
assignment reviewable end-to-end: one conversation flow, one Workflow, one clear output. The
same pattern (Worker → Durable Object for state → Workflow for multi-step reasoning) extends
naturally to things like multi-candidate pipelines, interview scheduling coordination, or
sourcing-outreach sequencing.

## AI-assisted development disclosure

This project was built with AI assistance (Claude, via Anthropic's claude.ai). See
`PROMPT_HISTORY.md` for the prompt history, as requested in the assignment instructions.
