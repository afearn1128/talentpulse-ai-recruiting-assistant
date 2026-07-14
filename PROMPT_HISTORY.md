# Prompt History

This project was built with AI-assisted coding using Claude (Anthropic), via claude.ai, as
permitted/encouraged by the assignment instructions.

## Session 1 — Initial build (Claude, claude.ai)

**Prompt:**
> "for a VP Talent Acquisition and Strategy role at Cloudflare I'm being asked to submit this
> exercise. Can you help me. Optional Assignment: Please share GitHub repo URL for the project
> here. We plan to fast track candidates who complete an assignment to build a type of
> AI-powered application on Cloudflare. An AI-powered application should include the following
> components: LLM (recommend using Llama 3.3 on Workers AI), or an external LLM of your choice;
> Workflow / coordination (recommend using Workflows, Workers or Durable Objects); User input via
> chat or voice (recommend using Pages or Realtime); Memory or state. Note: AI-assisted coding is
> encouraged, but you have to submit prompt history."

**What Claude produced:**
- Full project scaffold: `wrangler.toml`, `package.json`, `tsconfig.json`
- `src/llm.ts` — Workers AI (Llama 3.3) call helpers, including a structured-extraction prompt
- `src/conversationMemory.ts` — Durable Object providing per-conversation memory/state
- `src/screeningWorkflow.ts` — Cloudflare Workflow with four coordinated steps (fetch
  conversation → summarize candidate → score fit → generate recruiter brief)
- `src/index.ts` — Worker routing layer tying the chat UI, Durable Object, and Workflow together
- `public/index.html`, `public/style.css`, `public/chat.js` — chat UI served as static assets
- `README.md` — architecture, setup, and deployment instructions
- This prompt history file

## How to extend this section

If you iterate on the project further with AI assistance (fixing bugs after a local `wrangler dev`
run, adjusting the UI, changing the scoring prompt, etc.), add each subsequent prompt and a short
summary of what changed underneath this line, in chronological order:

---

<!-- Add follow-up prompts below -->
