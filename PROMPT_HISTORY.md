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

## Session 2 — Local verification, bug fixes, and deployment (Claude Opus 4.8, Claude Code)

Session 1 produced the code but never ran it. This session took the project from
"never executed" to "deployed, authenticated, and verified end-to-end on Cloudflare."

Two distinct bugs were found. Only the first was known at the start; the second was
hidden behind it and only surfaced once the first was fixed and real Workers AI calls
could run.

Prompts below are quoted verbatim where available. The first two stages happened
earlier in the session and are summarized rather than quoted.

### Stage 1 — Diagnosis: `src/screeningWorkflow.ts` would not parse

**What was found:** The top of `src/screeningWorkflow.ts` contained a large block of
chat-transcript prose — conversation text, instructions, and GitHub URLs — pasted in
above the `import` statements. This was an artifact of copying file contents out of a
chat window and into the GitHub web editor during Session 1. The module could not
parse, so the whole project failed to typecheck.

**Fix:** Deleted the pasted transcript, leaving the intended source. No logic changed.

**Commit:** `6f55345` — Remove chat transcript accidentally pasted into screeningWorkflow

### Stage 2 — Node.js toolchain

**What was found:** Nothing in the project had ever been run locally, because Node.js
was not installed on the machine. No `npm install`, typecheck, or `wrangler dev` had
executed against the Session 1 code.

**Fix:** Node.js installed and verified at **v24.18.0**, which unblocked local
verification.

### Stage 3 — Local verification

**Prompt:**
> "Continue from where we left off. Node is now installed and verified at v24.18.0.
> Run npm install, then npm run typecheck, then npm run dev to verify the fix works
> locally."

**What happened:**
- `npm install` succeeded. It flagged that three packages have install scripts that
  were not run under npm's allow-scripts gate (`esbuild`, `sharp`, `workerd`); this
  turned out not to block anything. It also reported 5 vulnerabilities (3 moderate,
  2 high).
- `npm run typecheck` passed clean — confirming the Stage 1 fix.
- `npm run dev` (`wrangler dev`) booted the Worker on `http://127.0.0.1:8787`.
- `GET /` and `GET /api/history` both returned 200, confirming static assets and the
  Durable Object worked.
- `POST /api/screen` created a real workflow instance and completed step 1
  (`fetch-conversation`), then **hung indefinitely on step 2** — the first Workers AI
  call.

**Diagnosis of the hang:** `npx wrangler whoami` reported *"You are not
authenticated."* The `AI` binding starts as `[connected to remote resource]`, so it
reaches the real Cloudflare account. Unauthenticated, the call hung rather than
erroring — and a hung AI request wedges the entire dev server until restart.

### Stage 4 — Second bug: Workers AI response shape (`src/llm.ts`)

**Prompt:**
> `npx wrangler login`

Authenticating removed the hang and immediately exposed a **second, unrelated bug**
that the first had been masking. `POST /api/chat` returned:

```
TypeError: text?.trim is not a function
```

**What was found:** `runChat()` assumed the Workers AI `.response` field is always a
string. It is not. Probing the raw payload showed Workers AI **pre-parses `.response`
into an object whenever the model emits valid JSON**:

- Chat reply → `"response": "It's great to connect..."` (a string — worked)
- Profile extraction → `"response": {"currentRole": "TypeScript engineer", ...}` (an
  object — crashed on `.trim()`)

This was not hypothetical for the workflow: the `score-fit` step asks for JSON-only
output, so it would have hit the identical crash.

**Fix:** Read `choices[0].message.content` first — the OpenAI-style field, which is
reliably the raw string in both shapes — and fall back to `.response`, stringifying it
when it is not a string.

**Verified:** `score-fit` returned a real score of 9 rather than the
`{score: 0, "Could not parse scoring output."}` fallback, proving the JSON path works.
All four workflow steps then completed locally against real Workers AI.

**Commit:** `1446196` — Fix runChat crash when Workers AI returns parsed JSON

### Stage 5 — Deployment to Cloudflare

**Prompt:**
> "Push these commits to GitHub, then deploy the app to Cloudflare with wrangler
> deploy and give me the live URL."

The deploy took three attempts, each blocked by a different issue:

**Blocker 1 — Durable Objects on the free plan.** The first `wrangler deploy` was
rejected:

> In order to use Durable Objects with a free plan, you must create a namespace using
> a `new_sqlite_classes` migration. [code: 10097]

`wrangler.toml` declared the DO with `new_classes` (KV-backed storage), which requires
a paid Workers plan. Changed the `v1` migration to `new_sqlite_classes`. Safe with no
code change: `ConversationMemory` only uses the `ctx.storage` key-value API that
SQLite-backed DOs fully support, and since the Worker had never deployed successfully
there was no namespace or data to migrate.

**Commit:** `03f8a5e` — Use SQLite-backed Durable Object migration

**Blocker 2 — no workers.dev subdomain.** The second attempt failed:

> You need a workers.dev subdomain in order to proceed. [code: 10063]

The account had never had one provisioned. This required a manual dashboard action
(opening **Workers & Pages** once), which the user performed.

**Prompt:**
> "done, created the subdomain – try the deploy again"

**Blocker 3 — TLS certificate provisioning (not a failure).** The third deploy
succeeded, but the URL was unreachable for ~90 seconds. This was nearly misread as a
broken deploy. `openssl s_client` showed `handshake_failure` (alert 40) with *"no peer
certificate available"*, while control requests to `example.com` and `workers.dev`
succeeded through the same client — isolating it to the brand-new subdomain's
certificate still provisioning. It resolved on its own.

**Live URL:** https://talentpulse-ai-recruiting-assistant.afearn1128.workers.dev

**Verified in production:** UI, Durable Object, chat, and profile extraction all
returned 200. The full screening workflow ran `queued → running → complete`, returning
a candidate summary, `fitScore: 9`, a rationale, and a formatted recruiter brief.

**Follow-up prompts:**
> "commit and push the wrangler.toml change"

> "commit the package-lock too"

**Commit:** `8ac9b39` — Add package-lock.json (pins the dependency tree for
reproducible installs and deploys)

### Stage 6 — Basic Auth password gate

**Prompt:**
> "add auth to the endpoints before I share the URL"

**Why:** The deployed app had no authentication. Anyone with the URL could drive
`/api/chat` and `/api/screen`, and every call bills Workers AI to the account.

**Design decision:** The UI is a browser app calling `/api/*` same-origin, which rules
out an API-key header — anything embedded in `chat.js` is public. Options weighed were
Basic Auth with a shared password, Cloudflare Access (Zero Trust), and a custom login
form with a signed cookie. **Basic Auth was chosen** as the right fit for sharing a
demo with a handful of people: the browser's native prompt works with the existing UI
untouched, and the password lives in a Worker secret.

**A bypass caught during testing:** The first implementation passed every API test but
`GET /` returned **200 with no credentials at all**. With `[assets]` configured,
Cloudflare serves matching static files directly from the edge **without invoking the
Worker**, so the auth check never ran for the UI — only `/api/*` was gated, because
those paths do not match a file. Fixed by setting `run_worker_first = true` on
`[assets]`, routing every request through the Worker. This was only caught by testing
the *unauthenticated* case rather than just confirming the correct password works.

**Implementation:**
- Basic Auth checked before any routing, so the UI, static assets, and every API route
  are covered.
- Password compared in constant time via `crypto.subtle.timingSafeEqual`.
- **Fails closed:** if `AUTH_PASSWORD` is unset, every request is rejected — a missing
  secret cannot silently expose the AI endpoints.
- Password stored via `npx wrangler secret put AUTH_PASSWORD`, run by the user so the
  value never entered the transcript. `.dev.vars` (local test password) added to
  `.gitignore` and never committed.

**Verified locally:** UI, `style.css`, and `/api/*` all 401 with no credentials and
with a wrong password; all 200 with the correct one; `WWW-Authenticate` header present
so browsers prompt; AI chat still works behind the gate; and with `AUTH_PASSWORD`
removed, everything 401s *even with the correct password*.

**Verified in production:** Every route returns 401 without credentials — UI, all three
static assets, and both AI endpoints — confirmed across four rounds over ~75 seconds.
(An initial run showed mixed 200s; this was deploy propagation, with some edge
locations still serving the previous version.) The user confirmed browser login and
chat work with the real secret, which the assistant could not test itself by design.

**Commit:** `37790aa` — Gate the Worker behind shared-password Basic Auth

### Session 2 summary

| Stage | Found | Fixed in |
|---|---|---|
| 1 | Chat transcript pasted above imports; module would not parse | `6f55345` |
| 2 | Node.js not installed; code had never run | v24.18.0 installed |
| 3 | AI calls hung — `wrangler` not authenticated | `wrangler login` |
| 4 | `runChat` crashed when Workers AI pre-parsed JSON into an object | `1446196` |
| 5 | DO migration needed `new_sqlite_classes` on the free plan | `03f8a5e` |
| 5 | No workers.dev subdomain; TLS cert provisioning delay | dashboard + wait |
| 6 | UI bypassed auth — edge served assets without invoking the Worker | `37790aa` |

**Known limitations, deliberately not addressed:**
- Basic Auth uses a single shared password with no per-person revocation; rotating it
  logs everyone out at once. Cloudflare Access is the upgrade path for real per-person
  identity.
- Cloudflare Workflows is in open beta on this plan.
- `wrangler` is a major version behind (3.114.17 vs 4.x) and warns on every command.
