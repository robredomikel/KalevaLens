# KalevaLens

KalevaLens is a multilingual, community-driven local-news prototype. Its existing Next.js interface is backed by a durable, human-supervised editorial workflow built with Gemini, LangGraph, Prisma, and PostgreSQL.

## Local setup

Requirements: Node.js 20+, npm, and PostgreSQL.

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:migrate
npm run dev
```

Edit `.env.local` before running migrations. Set `DATABASE_URL` and `DIRECT_URL` to the existing PostgreSQL database, generate a strong `SESSION_SECRET`, choose a private `MODERATOR_PASSCODE`, and put the single shared Gemini key in `GEMINI_API_KEY`. `.env.local` is ignored by Git.

`NEWS_RSS_FEEDS` accepts a comma-separated list of real RSS URLs. It is intentionally empty by default because the repository contained no authorized Kaleva feed URL; no endpoint is fabricated. The migration seeds only the three communities already present in the prototype.

The LangGraph PostgreSQL checkpointer uses the same `DATABASE_URL`. The additive migration creates its `langgraph` schema, and `PostgresSaver.setup()` creates/checks its checkpoint tables on first workflow use.

For an iPhone on public Wi-Fi, run the app and the account-free Cloudflare quick tunnel in separate terminals:

```bash
npm run dev
cloudflared tunnel --url http://127.0.0.1:3000
```

Open the generated HTTPS URL on the phone. Quick-tunnel URLs change after a restart.

### End-to-end editorial test

After applying the migration and configuring at least one real RSS URL, open `/moderator/kanban`, sign in with the configured passcode, and run these same-origin calls from the browser console:

```js
await fetch('/api/agents/ingest', { method: 'POST' }).then(r => r.json())
await fetch('/api/candidates?status=INGESTED').then(r => r.json())
await fetch('/api/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ candidateId: 'COPY_A_CANDIDATE_ID', targetLanguage: 'en' })
}).then(r => r.json())
```

Refresh the Kanban. An insufficient-evidence candidate stops at source review; an evidence-supported candidate eventually stops at mandatory final review. Approving the exact draft version resumes localization/contextualization and makes it eligible for `/api/articles`. Rejecting it keeps it out of the feed.

## Agent workflow

The ten logical agents are implemented as focused services and LangGraph nodes:

1. deterministic RSS/citizen-submission ingestion and deduplication;
2. news classification;
3. evidence-bound source verification;
4. story selection;
5. evidence-bound draft generation and versioning;
6. generated-content verification;
7. translation and localization validation;
8. contextual explanation;
9. deterministic personalized ranking;
10. community contribution analysis.

Gemini-powered nodes all use `lib/ai/gemini.ts`, one server-only `GEMINI_API_KEY`, agent-specific model variables, Zod-validated JSON output, bounded retries, exponential backoff, and timeouts. Model IDs can be changed independently without changing credentials.

The durable editorial graph is:

```text
classify -> verify sources -> optional source review -> select -> draft
  -> verify draft -> bounded revision -> mandatory final review
  -> localize -> contextualize -> publish
```

Both human checkpoints use LangGraph interrupts. The existing moderator Kanban reads persistent tasks and submits decisions to a role-protected backend. Publication is transactional and denied unless an authorized moderator/admin approved the exact current article version. A changed draft therefore requires a new approval.

Agent runs, models, status, references, errors, and token counts are stored in `AgentExecution`. `GET /api/workflows/:id` returns the workflow, candidate, and chronological execution history to moderators.

## Main API routes

- `POST /api/agents/ingest` — ingest configured sources (moderator/admin).
- `GET /api/candidates?status=INGESTED` — list candidates ready to start (moderator/admin).
- `POST /api/workflows` — start a candidate workflow (moderator/admin).
- `GET /api/workflows/:id` — inspect state and executions (moderator/admin).
- `GET /api/editorial/tasks` — load the persistent Kanban queue.
- `POST /api/editorial/tasks/:id/decision` — record and resume a human decision.
- `GET /api/articles` — return only approved-and-published, personalized articles.
- `GET|PUT /api/profile` — persistent, user-isolated profile preferences.
- `GET|POST /api/articles/:id/comments` — persistent discussion.
- `POST /api/articles/:id/corrections` — persistent correction request and editorial task.
- `POST /api/submissions` — persist an authenticated citizen story for ingestion.
- `POST /api/generate` — compatible authenticated three-bullet Gemini summary.

The feed maps published backend records into the existing cards. Until the database contains a published article it retains the old content as a visibly labeled development fixture. Persistent article comments use the backend; fixture comments remain local-only.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Automated tests mock Gemini and require neither a real API key nor a database. They cover shared configuration, structured output, editorial schemas, exact-version approval, unauthorized roles, and bounded revision routing.

## Prototype boundaries

The browser login UI remains the repository's local prototype identity flow. The new server session is signed and HTTP-only, and privileged routes enforce roles server-side, but production deployment should replace the prototype credential flow with the organization's identity provider and password hashing/verification. The in-process public-read rate limiter is a development safeguard; a multi-instance deployment should use a shared store or gateway limiter.

Live Gemini, RSS, and PostgreSQL integration cannot be exercised without developer-provided credentials and configured source URLs. The implementation fails closed: missing evidence goes to human review, missing approval prevents publication, and missing secrets produce explicit server errors.
