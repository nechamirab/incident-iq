# IncidentIQ

An AI-assisted incident-response and root-cause investigation tool for a university final
project. IncidentIQ helps engineering teams organize incident evidence, reconstruct timelines,
and reason carefully about root causes — while keeping humans in control of the final judgment.

The system is designed to always separate **facts** (directly supported by evidence), from
**assumptions** (plausible but unproven), **hypotheses** (explanations requiring testing), and
**actions** (concrete next steps). It never presents a hypothesis as a confirmed root cause.

> **Status:** Stage 8 — Critical AI Review. Stage 1 established the frontend/backend skeleton;
> Stage 2 added the domain model and mock data; Stage 3 made incident creation and file upload
> real; Stage 4 built the AI analysis pipeline; Stage 5 made the Incident Workspace real (Overview,
> Evidence, Facts & Assumptions); Stage 6 added Timeline and Hypotheses; Stage 7 added Reasoning
> Risks and Recommended Actions. Stage 8 adds a second, independent AI pass — a **skeptic
> review** that challenges the leading hypothesis of an incident's latest analysis run, surfaces
> alternative explanations, names evidence the original analysis never cited, assesses
> confirmation-bias risk, states what would falsify the leading hypothesis, and recommends
> further tests. It never overwrites or modifies the original analysis; it is always a separate,
> additional record. This introduced a new domain entity (`SkepticReview`), a new versioned prompt
> (`skeptic-review-v1`), a second AI-facing response schema, and a new `POST
> /api/incidents/:incidentId/skeptic-review` endpoint — all reusing the same provider-agnostic,
> validate-then-retry-once pipeline `analysisService` established in Stage 4 (now factored into a
> shared `runProviderWithRetry` helper both services call). The AI Review tab shows the latest
> run's audit information, a comparison across every analysis run performed on the incident, every
> skeptic review, and lets a human reviewer record their own notes on each one. Postmortem remains
> a named placeholder for Stage 9.

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
  even for a nearly-empty incident). It never pretends to be a real model. Its reasoning-risk
  detection is a set of genuine, generic heuristics against the incident's actual data (not
  hand-tuned to the bundled samples) that together reliably clear the spec's "at least three
  relevant biases" bar for both richly- and sparsely-evidenced incidents: `automation-bias`
  (always, an honest "this is a mock" disclosure), `confirmation-bias` (any hypothesis with no
  contradicting evidence -- this mock never generates any), `base-rate-neglect` (fewer than 5
  evidence items total), `post-hoc-fallacy` (deployment-note evidence present),
  `anchoring-bias` (evidence timestamped before the incident's recorded start), and
  `availability-bias` (one source type accounts for over half the evidence). Its recommended
  actions are similarly concrete: each names a specific metric or comparison and the actual time
  window drawn from that evidence cluster's own timestamps (e.g. "Query connection-pool
  utilization... for the window between 2026-06-14T14:20:00Z and 2026-06-14T14:44:00Z"), never
  generic advice like "investigate further".
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

### Skeptic review

`POST /api/incidents/:incidentId/skeptic-review` (`server/src/services/skepticReviewService.ts`)
runs a second, independent AI pass that critically challenges the **latest** analysis run's
leading (highest-confidence) hypothesis, and persists the result as a new `SkepticReview` — never
modifying the original `AnalysisRun`. It reuses the same provider-agnostic pipeline as the main
analysis, factored out into a shared `runProviderWithRetry` helper (`ai/runProviderWithRetry.ts`)
so both services get identical JSON-extraction, schema-validation, and one-shot-repair behavior
without duplicating it:

- **`skeptic-review-v1`** (`ai/prompts/skepticReviewV1.ts`) — tells the model exactly which
  hypothesis is leading (computed by the backend, not left for the model to determine) and asks it
  to challenge that hypothesis specifically: search for alternative explanations, assess
  confirmation-bias risk, state what would falsify it, and recommend further tests — never simply
  restate or validate the original analysis.
- **AI-facing schema** (`ai/schemas/skepticReviewResponse.schema.ts`) deliberately omits
  `challengedHypothesisId` and `ignoredEvidenceIds` entirely. Both are facts the backend can
  determine with certainty before it even calls the model — the leading hypothesis by comparing
  confidence scores, and "ignored" evidence by checking which evidence ids the original run never
  cited anywhere (facts, assumptions, timeline, hypotheses, reasoning risks, or actions) — so
  trusting the AI for either would only add a class of possible hallucination with no benefit.
  `mapSkepticReviewResponse.ts` computes and attaches both itself; the AI supplies only the
  qualitative critique.
- **`MockAIProvider`**'s skeptic-review output is exactly as deterministic and evidence-grounded as
  its main analysis: it names the leading hypothesis and its confidence, checks whether that
  hypothesis's supporting evidence leans on one dominant source type (and says so if it does), and
  reframes the run's other hypotheses as alternatives worth reconsidering.
- **Human notes** — `PATCH /api/incidents/:incidentId/skeptic-reviews/:reviewId/notes` lets a
  reviewer record their own take on a skeptic review, stored separately from (and never
  overwriting) its AI-generated content.

### Incident Workspace

`/incidents/:incidentId` (`IncidentWorkspacePage`) is a tabbed layout listing all nine sections
the finished app will have (`src/constants/workspaceSections.ts`); the one section not yet built
(Postmortem) renders a named placeholder ("Postmortem is not implemented yet... Stage 9") rather
than being hidden, so the intended navigation is visible end to end. Eight sections are fully
implemented:

- **Overview** — the incident description, plus the *latest* analysis run's summary, impact,
  affected components, uncertainty statement, validation warnings, and provenance
  (provider/model/prompt version/timestamp/duration). Shows an explicit empty state — never a
  blank section — when no analysis has run yet, with a "Run AI analysis" action in the header
  (`useAnalyzeIncident`) that also works as "Re-run" once a run exists.
- **Evidence** — every evidence item, searchable (source name, content, or id) and filterable by
  source type, each showing original vs. normalized content, a copy-to-clipboard action, and —
  computed from the latest run via `buildEvidenceReferenceIndex` — which facts, assumptions,
  hypotheses, timeline events, reasoning risks, or recommended actions cite it (e.g. "Referenced by
  2 facts, 1 hypothesis").
- **Timeline** — the latest run's events in chronological order (`sortTimelineEvents`, applied
  defensively even though the backend already sorts them), each showing an explicit
  exact/approximate/inferred/unknown label for its timestamp *and* a separate, clearly worded
  warning when `isInferred` is true — the type label and the inferred flag are shown independently
  since a timestamp can be inferred in a way its type label alone doesn't make obvious.
- **Hypotheses** — every candidate explanation, ranked by confidence
  (`sortHypothesesByConfidence`) but rendered with equal detail regardless of rank, since
  confidence is an investigation aid, not a verdict. Each card shows confidence as a progress bar
  *plus* a numeric value *plus* a text descriptor ("Moderate confidence") — never color alone —
  supporting and contradicting evidence as visually distinct groups (an empty contradicting list
  says so explicitly, rather than being blank), assumptions, the recommended test, expected
  result, and status (the AI can only ever leave a hypothesis `proposed`).
- **Facts & Assumptions** — facts, assumptions, and unsupported claims are always rendered as
  three visually distinct groups, never mixed. Each fact/assumption has a
  `ReviewStatusControl` wired to `PATCH .../statements/:statementId/review`
  (`InMemoryIncidentRepository.updateStatementReviewStatus` searches every analysis run on the
  incident for the matching statement id) — a human reviewer can mark any one supported, partially
  supported, unsupported, or rejected, independent of the AI's own confidence score.
- **Reasoning Risks** — only the biases the latest run actually flagged for itself, each showing
  the bias name, where it was detected (`detectedIn`), why it's dangerous, a risk-level chip,
  linked evidence (or an explicit note when a finding is about the analysis as a whole rather than
  specific evidence), and a suggested mitigation.
- **Recommended Actions** — every action from the latest run, sorted by priority
  (`sortActionsByPriority`: immediate → high → medium → low), each showing its category, expected
  outcome, risk, the evidence it's grounded in, and the hypothesis it relates to (resolved from id
  to title, clickable to jump to the Hypotheses tab). Open investigation questions are shown
  alongside, since an action's motivation is often "this would help answer an open question" —
  the schema has no id-level link between the two (open questions are plain strings), so this is a
  presentational connection, not a foreign key.
- **AI Review** — the latest run's audit information (provider/model/prompt version/timestamp/
  duration, validation warnings, unsupported claims); a run-comparison table across every analysis
  run performed on the incident (hidden behind a one-line note when only one run exists, since
  there's nothing yet to compare); a "Run skeptic review" action; and every skeptic review of the
  latest run — its challenge summary, alternative explanations, evidence the original analysis
  never cited (as clickable chips, like everywhere else), confirmation-bias assessment,
  falsification test, further recommended tests, overall assessment, its own provenance, and an
  editable notes field a human reviewer can save independently of the AI-generated content.

Every evidence id shown anywhere in Timeline, Hypotheses, Reasoning Risks, Recommended Actions, or
AI Review (`EvidenceReferenceChips`) is a clickable chip that jumps to the Evidence tab with that
id pre-filled into the search box — a cited piece of evidence is always one click away from the
claim that cites it.

Search text, the active evidence-type filter, and the active tab are held in `useWorkspaceStore`
(Zustand) — genuinely client-only UI state, reset whenever the user navigates to a different
incident. Everything else (the incident itself, analysis runs) stays in TanStack Query's cache;
nothing server-derived is duplicated into Zustand.

The New Incident form's "Save & analyze incident" action (previously disabled, promising "a later
development stage") now creates the incident, triggers analysis, and navigates to its workspace;
if analysis itself fails the incident was still created successfully, so the user still lands on
its workspace with a clear "no analysis yet" state and a retry button, rather than losing the
submission.

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
| Frontend | React, Vite, TypeScript (strict), React Router, Material UI, TanStack Query, Zustand, React Hook Form, Zod |
| Backend  | Node.js, Express, TypeScript (strict), CORS, dotenv, Zod, Multer, Anthropic SDK |
| Tooling  | ESLint (flat config), Prettier, Vitest, Supertest, npm workspaces           |

## Project structure

```
incident-iq/
  src/                     # Frontend application
    app/                   # App root, router, providers
    components/layout/     # Shared layout (header, shell)
    components/incidents/  # NewIncidentForm, LoadSampleIncidentButton, IncidentCreatedPanel
    components/evidence/   # EvidenceCard, FileUploadZone (drag-drop, preview, remove)
    components/workspace/  # WorkspaceHeader, Overview/Evidence/Timeline/Hypotheses/FactsAssumptions/
                            # ReasoningRisks/RecommendedActions/AIReview sections, HypothesisCard,
                            # ConfidenceIndicator, EvidenceReferenceChips, ReviewStatusControl,
                            # RunComparisonTable, SkepticReviewCard, PlaceholderSection
    components/common/     # ControlledTextField, CopyButton
    pages/                 # Route-level page components
    hooks/                 # React hooks (useIncident(s), useCreateIncident, useAnalyzeIncident,
                            # useReviewStatement, useRunSkepticReview, useUpdateSkepticReviewNotes, ...)
    services/              # Typed API clients (incidentService, analysisService, ...)
    store/                 # Zustand: workspace UI state only (active tab, evidence search/filter)
    schemas/               # Frontend-only Zod schemas (New Incident form)
    constants/              # Routes, query keys, workspace section config
    theme/                 # MUI theme tokens
    utils/                 # File validation/size formatting, evidence filtering/reference-indexing/sorting, status-display mapping
  server/                  # Backend application
    src/
      app.ts               # Express app factory (dependency-injectable repository + AI provider)
      server.ts            # HTTP listener entry point
      config/              # Environment configuration
      controllers/         # Request handlers
      routes/               # Route definitions
      middleware/           # Error handling, 404 handling, Multer upload, Zod body validation
      parsers/              # Text/JSON/CSV evidence parsers + extension dispatcher
      services/             # evidenceService, incidentService, analysisService, skepticReviewService
      schemas/              # Server-only request schemas (incident intake, statement review,
                            # skeptic review notes)
      repositories/         # IncidentRepository interface + in-memory implementation
      data/incidents/       # Bundled synthetic sample incidents
      ai/
        providers/           # AIProvider interface, MockAIProvider, AnthropicAIProvider, factory
        prompts/              # Versioned prompts (incident-analysis-v1, skeptic-review-v1,
                              # repair-invalid-json-v1)
        schemas/              # AI-facing structured-output Zod schemas (analysis, skeptic review)
        validators/           # JSON/schema validation, evidence-reference and unsupported-claim checks
        mapAnalysisResponse.ts       # Validated AI response -> persisted AnalysisRun
        mapSkepticReviewResponse.ts  # Validated AI response -> persisted SkepticReview
        runProviderWithRetry.ts      # Shared validate-then-retry-once orchestration
      utils/                # ApiError, id generation, text normalization, input hashing
    tests/                 # Vitest + Supertest (schemas, parsers, services, AI pipeline, API routes)
  shared/
    schemas/               # Zod schemas (source of truth for every domain model)
    types/                 # TypeScript types inferred from the Zod schemas
    constants/              # File-upload limits, evidence-field-to-source-type mapping
  tests/                   # Frontend pure-logic Vitest tests (schemas, utils, store)
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

To see the full loop: open the Dashboard, click "Start a new incident", click "Load sample
incident" to prefill a realistic example, then "Save & analyze incident" — you'll land on that
incident's workspace with a real (mock, by default) analysis already run. From there: Overview
shows the summary/impact/uncertainty statement, Evidence is searchable/filterable, Timeline shows
chronological events with confidence-labeled timestamps, Hypotheses shows every candidate
explanation ranked by confidence with supporting/contradicting evidence, Facts & Assumptions lets
you mark any statement's review status, Reasoning Risks shows the biases this specific analysis
flagged about itself, Recommended Actions shows concrete next steps ordered by priority, and AI
Review lets you run a skeptic review that challenges the leading hypothesis and record your own
notes on it. Clicking any evidence id chip anywhere jumps straight to that evidence item.

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

350 tests total:

- **Backend** (`server/tests/`, 260 tests) — everything from prior stages, plus this stage's
  skeptic-review pipeline coverage: `SkepticReviewSchema` validation; `validateSkepticReviewResponse`
  (JSON extraction/repair-fence handling, and confirming the AI's response is never required or
  allowed to supply `challengedHypothesisId`/`ignoredEvidenceIds`); `buildSkepticReviewPrompt`
  naming the correct leading hypothesis and every evidence id; `mapAiResponseToSkepticReview`
  computing `challengedHypothesisId` and `ignoredEvidenceIds` itself rather than trusting the AI,
  across every sample incident; `MockAIProvider`'s skeptic-review generation (deterministic,
  schema-valid for every sample, names the leading hypothesis, reframes other hypotheses as
  alternatives, falls back gracefully when a hypothesis has no resolvable supporting evidence or no
  siblings); `skepticReviewService` (success, retry-with-repair, both-attempts-invalid, 404 missing
  incident, 400 when no analysis run exists yet, always reviewing the *latest* run, never mutating
  the original run, passing the run as completion context); the `POST .../skeptic-review` and
  `PATCH .../skeptic-reviews/:reviewId/notes` routes end to end; and the new
  `addSkepticReview`/`updateSkepticReviewNotes` repository methods.
- **Frontend** (`tests/`, 90 tests) — everything from prior stages, plus `summarizeAnalysisRuns`
  (the AI Review tab's run-comparison table logic: preserves run order, carries provenance through
  unchanged, finds the highest hypothesis confidence per run, and returns `null` rather than `-Infinity`
  when a run has no hypotheses).

Full component-level React Testing Library tests are introduced in Stage 10 — the workspace UI is
exercised via its underlying pure logic and via live API smoke tests against a running server, not
by rendering React components in a test runner. `AnthropicAIProvider` is still not exercised
against the live Anthropic API (no network calls in tests, no API key available in this
environment).

## Known limitations (Stage 8)

- One of the nine workspace tabs (Postmortem) remains a placeholder naming the stage that builds
  it (9).
- A skeptic review always reviews the incident's *latest* analysis run; there is no way to request
  a skeptic review of an older run once a newer one exists, matching how every other workspace tab
  already treats "the latest run" as authoritative.
- Recommended Actions and open investigation questions are shown together in the same tab, but
  there is no id-level link between a specific action and a specific question — `openQuestions` is
  a plain `string[]` on `AnalysisRun`, not a list of objects with ids, matching the original data
  model. The connection is presentational (shown side by side), not a foreign key.
- Redaction of sensitive values before sending evidence to a real AI provider is still not
  implemented (unchanged from Stage 4) — evidence is sent to Anthropic as-is when
  `AI_PROVIDER=anthropic`.
- No full-page/component-level frontend test suite (React Testing Library) yet, and no browser
  tool is available in this environment to click through the new AI Review UI — typecheck, lint,
  the full test suite, and a production build were all verified, plus a live smoke test against the
  running server confirming: analyze → skeptic review → notes PATCH all persist and link correctly
  (`analysisRunId` and `challengedHypothesisId` both resolve to the right records), a second
  analyze + skeptic review cycle populates the run-comparison table with two real rows, a 400 is
  returned when a skeptic review is requested before any analysis exists, and a 404 is returned for
  a missing incident.

## Roadmap

See the project brief for the full ten-stage plan: shared models & mock data, incident input &
file upload, AI provider architecture, evidence workspace, timeline & hypotheses, reasoning-risk
detection, critical AI review, postmortem export, and final testing/polish.
