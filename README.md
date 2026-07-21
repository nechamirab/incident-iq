# IncidentIQ

An AI-assisted incident-response and root-cause investigation tool for a university final
project. IncidentIQ helps engineering teams organize incident evidence, reconstruct timelines,
and reason carefully about root causes — while keeping humans in control of the final judgment.

The system is designed to always separate **facts** (directly supported by evidence), from
**assumptions** (plausible but unproven), **hypotheses** (explanations requiring testing), and
**actions** (concrete next steps). It never presents a hypothesis as a confirmed root cause.

> **Status:** Stage 4 — AI Architecture and Reasoning Pipeline. Stage 1 established the
> frontend/backend skeleton; Stage 2 added the domain model layer and mock data; Stage 3 made
> incident creation and file upload real end-to-end. Stage 4 adds a working `POST
> /api/incidents/:incidentId/analyze`: a provider-agnostic `AIProvider` interface, a deterministic
> offline `MockAIProvider`, a real `AnthropicAIProvider`, versioned prompts, strict Zod validation
> of the AI's structured JSON output with one automatic repair retry, evidence-reference
> cross-checking, and full `AnalysisRun` audit metadata. Rendering the results in the UI (Overview,
> Hypotheses, Timeline, etc.) is introduced in Stages 5–6.

## Architecture

Single repository, two runtimes, one shared model layer:

- **`src/`** — React + Vite + TypeScript frontend (Material UI, TanStack Query, React Router).
- **`server/`** — Express + TypeScript backend, exposing a REST API under `/api`.
- **`shared/`** — Zod schemas (source of truth) and inferred TypeScript types used by both the
  frontend and backend, so request/response/domain shapes are never duplicated.

### Domain model

Every domain entity is defined once as a Zod schema in `shared/schemas/`, with its TypeScript
type inferred from that schema (`z.infer<...>`) and re-exported from `shared/types/` for
ergonomic type-only imports. The model covers the full investigation lifecycle:

- **Incident** — metadata plus nested `evidence` and `analysisRuns`.
- **EvidenceItem** — a single, individually-referenceable piece of evidence.
- **ReasoningItem** — a categorized fact or assumption, always evidence-linked.
- **TimelineEvent** — a reconstructed event with an explicit timestamp-confidence label.
- **Hypothesis** — a falsifiable candidate explanation, with supporting/contradicting evidence.
- **BiasFinding** — a detected reasoning risk (confirmation bias, anchoring, etc.).
- **RecommendedAction** — a concrete, evidence-linked next step.
- **AnalysisRun** — the full, validated result of one AI (or mock) analysis pass.
- **Postmortem** — a human-reviewed draft report.

The AI never sets a hypothesis to `confirmed-by-human` — only an explicit human review action can.

### AI architecture and reasoning pipeline

`POST /api/incidents/:incidentId/analyze` runs one AI analysis pass over an incident's evidence
and persists the result. The pipeline (`server/src/ai/`, orchestrated by
`server/src/services/analysisService.ts`) is provider-agnostic end to end:

- **`AIProvider`** (`ai/providers/AIProvider.ts`) — the only interface `analysisService` depends
  on. `complete(incident, prompt)` returns a provider's raw text response; nothing above this
  layer knows or cares which concrete provider produced it.
- **`MockAIProvider`** — the default (`AI_PROVIDER=mock`). Fully deterministic and offline: it
  groups an incident's evidence by source type and derives a structured analysis from those
  clusters (facts, a timeline from every timestamped item, hypotheses padded to at least three
  even for a nearly-empty incident, and reasoning risks including an honest "this is a mock, not a
  reviewed analysis" automation-bias finding). It never pretends to be a real model.
- **`AnthropicAIProvider`** — the real provider (`AI_PROVIDER=anthropic`), backed by the Anthropic
  Messages API. A missing `ANTHROPIC_API_KEY` is checked lazily, on first use, and raises a clear
  503 error explaining how to switch back to `mock` — it never crashes the app at startup.
- **Versioned prompts** (`ai/prompts/`) — `incident-analysis-v1` builds the system/user prompt from
  the incident and its evidence (each item labeled with its exact id so the model can cite it);
  `repair-invalid-json-v1` is a one-shot correction prompt used only on retry.
- **Structured output schema** (`ai/schemas/aiAnalysisResponse.schema.ts`) — a Zod schema distinct
  from the persisted `AnalysisRun`/`Hypothesis`/etc. schemas in `shared/schemas/`: every
  system-managed field (`id`, `reviewStatus`, a hypothesis's lifecycle `status`) is omitted, since
  the AI must never assign them. Hypotheses instead carry a model-invented `tempId` (`"H1"`, `"H2"`,
  …) so `recommendedActions` can forward-reference a hypothesis before real ids exist; at least
  three hypotheses and at least one evidence id per fact are enforced by the schema itself, not
  just prompt instructions.
- **Validation** (`ai/validators/`) — `validateAIResponse` extracts JSON (tolerating a stray
  markdown code fence) and validates it against the schema; `findUnknownEvidenceReferences` flags
  any cited evidence id that isn't real (hallucination detection Zod alone can't do);
  `detectUnsupportedFacts` demotes a "fact" whose only cited evidence turned out to be invalid.
- **Retry** — an invalid response (bad JSON or a schema mismatch) is retried exactly once with a
  repair prompt describing what was wrong. A second failure raises a controlled `AI_RESPONSE_INVALID`
  error rather than ever persisting or returning malformed data.
- **`mapAiResponseToAnalysisRun`** — converts the validated response into a persisted
  `AnalysisRun`: assigns real ids to every nested item, resolves each `tempId` to its real
  hypothesis id (dropping and warning on any that don't resolve), force-sets
  `reviewStatus: 'unreviewed'` and `status: 'proposed'`/`'suggested'`, and records every warning
  found above.
- **Run metadata** — every `AnalysisRun` records `provider`, `model`, `promptVersion` (which one
  actually produced the result — the retry's `repair-invalid-json-v1` if a repair was needed),
  `durationMs`, and `inputHash` (a SHA-256 of the exact evidence set analyzed, order-independent).

While a request is in flight the incident's status is `analyzing`; it becomes
`under-investigation` on success, or reverts to whatever it was before on any failure — an
incident is never left stuck in a transient state.

### Mock data and persistence

`server/src/data/incidents/` ships three realistic, deliberately ambiguous synthetic incidents
(e-commerce checkout failure, course-registration slowdown, mobile login failure) — each with
8+ evidence items mixing plausible causes, red herrings, and contradictory signals, so no single
log line gives away the root cause. `server/src/repositories/` defines an `IncidentRepository`
interface and an in-memory implementation seeded from that data; later stages' controllers will
depend only on the interface, so a real database can be swapped in without touching calling code.

The frontend never talks to an AI provider directly and never holds an AI API key — all AI
integration happens on the backend (see "AI architecture and reasoning pipeline" above).

### Incident intake and file parsing

The New Incident page lets a user describe an incident and paste evidence into seven
category-specific fields (application logs, error traces, monitoring alerts, deployment notes,
user complaints, API errors, database errors) — each mapped to its evidence source type via
a single shared lookup table (`shared/constants/evidenceFields.ts`) used by both the form and the
backend, so the mapping can never drift. Each non-empty pasted line becomes its own evidence item;
the description becomes a single evidence item.

Uploaded files (`.txt`, `.log`, `.json`, `.csv`, up to 2 MB each, 10 files per incident) are kept
in memory only (never written to disk, so a file name can never influence a server filesystem
path) and dispatched by extension to a dedicated parser:

- **`.txt` / `.log`** — one evidence item per non-empty line.
- **`.json`** — one evidence item per array element (or a single item for a top-level object),
  with a best-effort timestamp extracted from a recognizable field.
- **`.csv`** — one evidence item per data row, using the header row as field names.

Every parser only ever reads file content as text or parses it with `JSON.parse` / a hand-rolled
CSV tokenizer — uploaded content is never evaluated or executed. All evidence extraction (both
pasted text and uploaded files) is exercised end-to-end by `POST /api/incidents`, which creates
the incident and its full evidence list in one request.

## Technology stack

| Layer    | Technology                                                                 |
| -------- | --------------------------------------------------------------------------- |
| Frontend | React, Vite, TypeScript (strict), React Router, Material UI, TanStack Query, React Hook Form, Zod |
| Backend  | Node.js, Express, TypeScript (strict), CORS, dotenv, Zod, Multer, Anthropic SDK |
| Tooling  | ESLint (flat config), Prettier, Vitest, Supertest, npm workspaces           |

## Project structure

```
incident-iq/
  src/                     # Frontend application
    app/                   # App root, router, providers
    components/layout/     # Shared layout (header, shell)
    components/incidents/  # NewIncidentForm, LoadSampleIncidentButton, IncidentCreatedPanel
    components/evidence/   # FileUploadZone (drag-drop, preview, remove)
    pages/                 # Route-level page components
    hooks/                 # React hooks (useHealthCheck, useIncidents, useCreateIncident)
    services/              # Typed API clients
    schemas/               # Frontend-only Zod schemas (New Incident form)
    constants/              # Routes, query keys
    theme/                 # MUI theme tokens
    utils/                 # File validation/size formatting, sample-incident form mapping
  server/                  # Backend application
    src/
      app.ts               # Express app factory (dependency-injectable repository + AI provider)
      server.ts            # HTTP listener entry point
      config/              # Environment configuration
      controllers/         # Request handlers
      routes/               # Route definitions
      middleware/           # Error handling, 404 handling, Multer upload, Zod body validation
      parsers/              # Text/JSON/CSV evidence parsers + extension dispatcher
      services/             # evidenceService, incidentService, analysisService
      schemas/              # Server-only request schemas (incident intake)
      repositories/         # IncidentRepository interface + in-memory implementation
      data/incidents/       # Bundled synthetic sample incidents
      ai/
        providers/           # AIProvider interface, MockAIProvider, AnthropicAIProvider, factory
        prompts/              # Versioned prompts (incident-analysis-v1, repair-invalid-json-v1)
        schemas/              # AI-facing structured-output Zod schema
        validators/           # JSON/schema validation, evidence-reference and unsupported-claim checks
        mapAnalysisResponse.ts # Validated AI response -> persisted AnalysisRun
      utils/                # ApiError, id generation, text normalization, input hashing
    tests/                 # Vitest + Supertest (schemas, parsers, services, AI pipeline, API routes)
  shared/
    schemas/               # Zod schemas (source of truth for every domain model)
    types/                 # TypeScript types inferred from the Zod schemas
    constants/              # File-upload limits, evidence-field-to-source-type mapping
  tests/                   # Frontend pure-logic Vitest tests (schemas, utils)
  .env.example
  package.json             # Frontend package + npm workspaces root
```

## Installation

Requires Node.js 20+ and npm 10+.

```bash
npm install
```

This installs both the frontend dependencies (root) and the backend dependencies
(`server/`, via the npm workspace).

## Environment variables

Copy the example file and adjust as needed:

```bash
cp .env.example .env
```

| Variable             | Used by  | Description                                                      |
| --------------------- | -------- | ------------------------------------------------------------------ |
| `PORT`                | backend  | Port the Express API listens on (default `4001`).                  |
| `NODE_ENV`             | backend  | `development`, `production`, or `test`.                            |
| `CORS_ORIGIN`          | backend  | Origin allowed to call the API (default the Vite dev server).      |
| `AI_PROVIDER`          | backend  | `mock` (default, offline, deterministic) or `anthropic` (real analysis). |
| `ANTHROPIC_API_KEY`    | backend  | Only required when `AI_PROVIDER=anthropic`. Never committed. Missing key → clear 503, not a crash. |
| `ANTHROPIC_MODEL`      | backend  | Optional; which Anthropic model to call. Defaults to `claude-sonnet-5`. |
| `VITE_API_BASE_URL`    | frontend | Base URL the frontend uses to reach the backend (default `http://localhost:4001`). |

The backend loads `.env` from the repository root. The Anthropic API key is read only on the
backend and is never bundled into frontend code.

> If the backend fails to start with an "address already in use" error, another process on your
> machine already holds that port. Change `PORT` (and update `VITE_API_BASE_URL` to match) in
> `.env` and restart.

## Running the project

Run both frontend and backend together:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4001/api/health

Or run them separately:

```bash
npm run dev:client   # Vite dev server only
npm run dev:server   # Express API only (tsx watch mode)
```

The Dashboard page calls `/api/health` on load and displays the connection status, so a
successful load confirms the full stack is wired correctly.

Since there's no UI for it yet (Stages 5–6), try the AI pipeline directly:

```bash
curl -s -X POST http://localhost:4001/api/incidents/sample-ecommerce-checkout/analyze | jq
```

With the default `AI_PROVIDER=mock`, this returns immediately with a full, schema-valid
`AnalysisRun` — no API key required.

## Building

```bash
npm run build            # builds frontend (dist/) and backend (server/dist/)
npm run build:client
npm run build:server
```

## Checks

```bash
npm run typecheck   # TypeScript project references, frontend + backend
npm run lint         # ESLint across the whole repository
npm run format        # Prettier --write
```

## Testing

```bash
npm run test          # frontend pure-logic tests, then backend tests
npm run test:client   # frontend only (Vitest, node environment)
npm run test --workspace=server   # backend only (Vitest + Supertest)
```

192 tests total:

- **Backend** (`server/tests/`, 167 tests) — every Zod schema, sample-data integrity, full
  `IncidentRepository` CRUD, every parser, `evidenceService`'s field-to-source-type mapping, the
  incident intake request schema, and full API route tests via Supertest — each test run gets its
  own isolated in-memory repository via dependency injection (`createApp({ incidentRepository,
  aiProvider })`), never the shared process singletons. The AI pipeline specifically is covered by:
  - `MockAIProvider` producing schema-valid, evidence-grounded output for all three sample
    incidents *and* a minimal incident with only a description (the ≥3-hypotheses padding path),
    with every cited evidence id verified to be real.
  - `validateAIResponse` handling well-formed JSON, a wrapped markdown code fence, stray
    commentary around the JSON, and both malformed-JSON and schema-mismatch failures.
  - `findUnknownEvidenceReferences` / `detectUnsupportedFacts` catching hallucinated evidence ids
    in every response section.
  - `mapAiResponseToAnalysisRun` resolving hypothesis `tempId`s to real ids (including a dropped,
    warned-about unresolvable reference) and force-setting every system-managed field.
  - `analysisService`, via a scripted `FakeAIProvider`, exercising the full retry flow: first-try
    success, invalid-then-repaired success, invalid-twice failure (with incident status correctly
    reverted), a thrown provider error, and a missing-incident 404.
  - `AnthropicAIProvider`'s missing-API-key path (a controlled 503, no network call attempted).
  - Live route tests (`POST /api/incidents/:id/analyze`) covering success, 404, a
    fails-after-retry 502, and — with a real `AnthropicAIProvider` constructed without a key,
    injected into a real Express app — the full-stack missing-key error path.
- **Frontend** (`tests/`, 25 tests) — the New Incident form's Zod schema, client-side file
  validation, file-size formatting, and the sample-incident-to-form-values reconstruction logic.

Full component-level React Testing Library tests are introduced in Stage 10. `AnthropicAIProvider`
is not exercised against the live Anthropic API in automated tests (no network calls in CI, and no
API key is available in this environment) — verified instead via a live smoke test of the mock
pipeline against the running server, plus the missing-key path above.

## Known limitations (Stage 4)

- No UI renders analysis results yet — the Overview/Hypotheses/Timeline/Reasoning-Risks screens
  are Stages 5–6. The "Analyze incident" button in the New Incident form is still disabled (it
  operates on an incident that doesn't exist until after submission); triggering analysis today
  means calling `POST /api/incidents/:id/analyze` directly.
- The skeptic/critical review pass, bias-review prompt, and postmortem generation are separate
  features from later stages (8–9) and are not implemented — Stage 4's `reasoningRisks` come from
  the same single analysis call, not a dedicated adversarial review.
- Redaction of sensitive values (emails, tokens, credentials) before sending evidence to a real AI
  provider is not implemented yet — evidence is sent to Anthropic as-is when `AI_PROVIDER=anthropic`.
  The New Incident form's privacy warning still applies.
- `AnthropicAIProvider` has not been exercised against the live API (see Testing above) — its
  request/response handling is implemented per the SDK's documented types but unverified against
  a real key.

## Roadmap

See the project brief for the full ten-stage plan: shared models & mock data, incident input &
file upload, AI provider architecture, evidence workspace, timeline & hypotheses, reasoning-risk
detection, critical AI review, postmortem export, and final testing/polish.
