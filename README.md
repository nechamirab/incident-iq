# IncidentIQ

An AI-assisted incident-response and root-cause investigation tool for a university final
project. IncidentIQ helps engineering teams organize incident evidence, reconstruct timelines,
and reason carefully about root causes — while keeping humans in control of the final judgment.

The system is designed to always separate **facts** (directly supported by evidence), from
**assumptions** (plausible but unproven), **hypotheses** (explanations requiring testing), and
**actions** (concrete next steps). It never presents a hypothesis as a confirmed root cause.

> **Status:** Stage 10 — Postmortem Export and Final Polish. All ten stages are now complete. Stage 1
> established the frontend/backend skeleton; Stage 2 added the domain model and mock data; Stage 3
> made incident creation and file upload real; Stage 4 built the AI analysis pipeline; Stage 5 made
> the Incident Workspace real (Overview, Evidence, Facts & Assumptions); Stage 6 added Timeline and
> Hypotheses; Stage 7 added Reasoning Risks and Recommended Actions; Stage 8 added the
> skeptic-review AI Review tab; Stage 9 made the Dashboard a real incident list with breadcrumb
> navigation throughout. Stage 10 fills in the last workspace tab -- **Postmortem** -- and closes out
> the project:
>
> - An AI-drafted postmortem (a third AI pass, alongside the main analysis and skeptic review) that
>   every field of stays human-editable in place after drafting -- a deliberately different design
>   from the skeptic review's AI-authored-plus-notes model, since a postmortem is meant to become
>   the team's own document. "Likely cause" language is used unless a hypothesis is explicitly
>   `confirmed-by-human`.
> - Full editing (`PATCH /api/incidents/:incidentId/postmortem`) and regeneration (`POST`, which
>   discards prior edits -- the UI warns before this) of the draft.
> - Export as a standalone Markdown document, either copied to the clipboard or downloaded as a
>   `.md` file, independent of the IncidentIQ app itself.
> - Final polish: route-level code splitting (the three substantial pages now load on demand rather
>   than in the initial bundle), a top-level error boundary so an unexpected render error shows a
>   friendly fallback instead of a blank screen, and removal of the now-dead
>   `PlaceholderSection`/`arrivingInStage` placeholder machinery now that every workspace tab is
>   implemented.
>
> **Post-Stage-10 polish -- UX flow and incident lifecycle.** With every tab built, this pass turned
> the workspace into a guided investigation flow rather than a set of independent tabs: an editable
> status selector (with a proper resolution workflow) replaces the old static status chip, a
> five-step progress banner ties the whole investigation together, evidence can be added to an
> incident after creation instead of only at intake, and the workspace now tells you when new
> evidence has outpaced the last analysis run. See "Incident lifecycle and guided investigation"
> below for details.

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

- **Incident** — metadata plus nested `evidence`, `analysisRuns`, `skepticReviews`, and a single
  `postmortem` (nullable until one is drafted).
- **EvidenceItem** — a single, individually-referenceable piece of evidence.
- **ReasoningItem** — a categorized fact or assumption, always evidence-linked.
- **TimelineEvent** — a reconstructed event with an explicit timestamp-confidence label.
- **Hypothesis** — a falsifiable candidate explanation, with supporting/contradicting evidence.
- **BiasFinding** — a detected reasoning risk (confirmation bias, anchoring, etc.).
- **RecommendedAction** — a concrete, evidence-linked next step.
- **AnalysisRun** — the full, validated result of one AI (or mock) analysis pass.
- **SkepticReview** — a critical second pass challenging an analysis run's leading hypothesis;
  append-only like `AnalysisRun`, never overwriting the run it reviews.
- **Postmortem** — a human-reviewed draft report. Unlike the append-only entities above, this is a
  *single evolving document* per incident: every field stays editable in place after the AI drafts
  it, rather than being paired with a separate human-notes field (see its schema doc comment).

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

### Postmortem

A third AI pass (`server/src/services/postmortemService.ts`), reusing the same
`runProviderWithRetry` pipeline as the main analysis and skeptic review, but structurally different
from both: a postmortem is a single evolving document per incident, not an append-only record, and
every field the AI drafts stays directly human-editable afterward rather than being paired with a
separate notes field.

- **`postmortem-v1`** (`ai/prompts/postmortemV1.ts`) — drafts a full postmortem from the incident
  and its latest analysis run. Explicitly instructed to use hedged "likely cause" language unless a
  hypothesis is `confirmed-by-human`; to list every hypothesis investigated, not only the leading
  one; to never invent a resolution for an incident that isn't `resolved`; and to ground
  `correctiveActions`/`lessonsLearned`/`followUpItems` in the run's own recommended actions,
  reasoning risks, and open questions rather than generic advice.
- **AI-facing schema** (`ai/schemas/postmortemResponse.schema.ts`) is derived from the persisted
  `PostmortemSchema` via `.omit(...)`, dropping only its five system-managed provenance fields
  (`provider`/`model`/`promptVersion`/`generatedAt`/`lastEditedAt`) -- the same "AI drafts content,
  the backend attaches provenance" principle used for the main analysis and skeptic review, applied
  through schema composition instead of a hand-duplicated field list.
- **`MockAIProvider`**'s postmortem draft is fully deterministic: `detection` names the dominant
  evidence source type, `contributingFactors` includes every hypothesis within 20 confidence points
  of the leading one, `resolution` explicitly states the incident is unresolved unless
  `resolvedAt` is set, and `lessonsLearned`/`correctiveActions`/`followUpItems` are drawn directly
  from the run's own reasoning risks, recommended actions, and open questions.
- **Generate vs. edit** — `POST /api/incidents/:incidentId/postmortem` (re)generates a draft,
  *fully replacing* any existing one, including prior human edits (the UI's "Regenerate" button
  says so). `PATCH /api/incidents/:incidentId/postmortem` merges a human's edits into the existing
  draft and bumps `lastEditedAt` only -- `generatedAt` and the rest of the draft's provenance are
  untouched by editing.
- **Export** — `buildPostmortemMarkdown` (pure, unit-tested) renders the current draft as a
  standalone Markdown document (incident metadata, every field under its own heading, a provenance
  footer), which the Postmortem tab offers as a clipboard copy or a `.md` file download -- neither
  requires the backend.

### Dashboard and navigation

`/` (`DashboardPage`) lists every incident -- bundled samples plus any the user created -- most
recently updated first (`sortIncidentsByUpdatedAt`), each row linking straight to its workspace:

- **Status summary** (`IncidentStatusSummary`) — a row of count chips in a fixed lifecycle order
  (`summarizeIncidentsByStatus`), including zero-count statuses so the row never reflows as counts
  change, plus a running total.
- **Search and filter** (`IncidentFilterBar` + `filterIncidents`) — free-text search against title,
  affected service, and id, combined (AND, not OR) with independent status and severity dropdowns,
  their options driven directly from `IncidentStatusSchema.options`/`IncidentSeveritySchema.options`
  so they can never drift from the domain model.
- **Incident table** (`IncidentListTable`) — title, status, severity, affected service, detected-at,
  and updated-at for every matching incident. Each title is a real router link (not just a row
  click handler), so navigating to a workspace works from the keyboard and for screen readers, not
  only by mouse.
- Explicit loading, error, and empty states (`isLoading`/`isError`, and "No incidents yet" versus
  "No incidents match the current search/filter" for the two different kinds of empty results) --
  never a silently blank list.

The backend-connection health check from earlier stages is still shown, now as a secondary card
below the incident list rather than the page's main content.

Every page below the Dashboard (`IncidentWorkspacePage`, `NewIncidentPage`) now renders a
`PageBreadcrumbs` trail (`Dashboard / <page>`) at its top, so there is always an explicit way back
that doesn't depend on the browser's back button -- every breadcrumb but the current page is a real
link.

### Incident Workspace

`/incidents/:incidentId` (`IncidentWorkspacePage`) is a tabbed layout with all nine sections
(`src/constants/workspaceSections.ts`) fully implemented:

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
- **Postmortem** — an empty state prompting AI analysis first, then "Generate postmortem draft"
  once analysis exists. Once a draft is generated, every field is a real editable control (plain
  text fields for the seven prose fields, an add/edit/remove list editor for the five array
  fields), a "Save changes" button enabled only while dirty, "Regenerate draft (discards edits)"
  clearly labeled as destructive, draft provenance chips, and export actions ("Copy" and
  "Download as Markdown") that work from the current in-browser draft, not a server round-trip.

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

### Incident lifecycle and guided investigation

- **Editable status** (`IncidentStatusSelector`, replacing the old static status chip in
  `WorkspaceHeader`) — a button-triggered menu offering every status a human may choose directly:
  `draft`, `under-investigation`, `resolved`, `archived`. `analyzing` is deliberately excluded --
  it's a transient, system-managed state the backend sets automatically while an AI analysis run is
  in flight, never a state a user selects (see `UserSelectableIncidentStatusSchema`, derived from
  the full status enum via `.exclude(['analyzing'])` so the two lists can never drift apart).
  `PATCH /api/incidents/:incidentId/status` is the endpoint behind it -- the first partial-update
  endpoint the API actually exposed; `IncidentRepository.update()` already supported arbitrary
  partial updates, but nothing had wired it to a route until now.
- **Resolution workflow** — selecting "resolved" opens a confirmation dialog (`resolvedAt`
  defaulting to now, optional free-form resolution notes) rather than updating immediately;
  cancelling leaves the incident untouched. The lifecycle rules live in one pure, unit-tested
  function, `incidentLifecycleService.computeResolvedAt`: resolving sets `resolvedAt` to the
  confirmed time; archiving preserves whatever `resolvedAt` already was (`null` if the incident was
  never resolved -- archiving must never invent a resolution time); any other transition (reopening)
  clears it. `resolutionNotes` is a new field on `Incident` (`shared/schemas/incident.schema.ts`,
  threaded through every layer down to the sample data), only overwritten when a request explicitly
  supplies it, so reopening an incident preserves its prior notes rather than silently discarding
  them.
- **Optimistic updates** — `useUpdateIncidentStatus` updates the cached incident immediately (via a
  pure, independently-tested `applyOptimisticStatusUpdate` that mirrors the backend's transition
  rules), rolls back to a snapshot taken before the mutation if the request fails, and invalidates
  every incident-related query (`incident`, `incidents`, `sampleIncidents`) once it settles --
  entirely through the existing TanStack Query cache, nothing duplicated into Zustand. The Dashboard
  needs no separate refresh: its status summary, filters, and list are already derived from the same
  `incidents` query.
- **Investigation progress banner** (`InvestigationProgressBanner`, driven by the pure
  `getInvestigationSteps` utility) — five steps (Review Evidence, Analyze and Hypothesize, Evaluate
  Risks and Skeptic Review, Draft Postmortem, Resolve Incident), each independently derived from the
  incident's actual data (evidence present, a *successful* analysis run with hypotheses, that run's
  reasoning risks *and* a skeptic review, a postmortem, and `status === 'resolved'` respectively) --
  never from `status` alone, and never assuming steps complete in order. The first incomplete step
  is "current"; every step still reports its own true completion even when a later one finished
  first (e.g. a postmortem drafted before a skeptic review was ever run). Clicking a step switches
  to its workspace tab; "Resolve Incident" has no tab of its own, so it focuses the status selector
  instead.
- **Adding evidence to an existing incident** (`AddEvidenceDialog`, opened from the Evidence tab) —
  a Zod/React-Hook-Form-validated dialog for one evidence item at a time (application log snippet,
  monitoring alert, or support/user message; content is rejected if blank or whitespace-only). Backed
  by a new `POST /api/incidents/:incidentId/evidence`, which reuses the existing
  `IncidentRepository.addEvidence` persistence path and the same id-generation/normalization
  utilities the New Incident form's bulk intake already uses -- evidence ids are always generated on
  the backend, never in the browser.
- **Outdated-analysis indication** (`OutdatedAnalysisBanner`, driven by the pure
  `getAnalysisFreshness` utility) — compares the newest evidence `createdAt` against the latest
  *successful* analysis run's `createdAt`; nothing is persisted for this, it's recomputed from
  existing data every render. An incident with no successful analysis yet is reported as
  `"not-analyzed"`, never `"outdated"`. When evidence outpaces the last analysis, a compact banner
  explains that the visible results may not reflect the newer evidence and offers "Re-run AI
  analysis" -- sharing the exact same `useAnalyzeIncident` mutation (and its `isPending` state)
  already wired to the header's own analyze button, so the two triggers can never fire simultaneous
  requests, and analysis is never triggered automatically.

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
    app/                   # App root, lazy-loaded route table, providers, ErrorBoundary
    components/layout/     # Shared layout (header, shell, PageBreadcrumbs, ErrorBoundary)
    components/dashboard/  # IncidentStatusSummary, IncidentFilterBar, IncidentListTable
    components/incidents/  # NewIncidentForm, LoadSampleIncidentButton, IncidentCreatedPanel
    components/evidence/   # EvidenceCard, FileUploadZone (drag-drop, preview, remove)
    components/workspace/  # WorkspaceHeader, Overview/Evidence/Timeline/Hypotheses/FactsAssumptions/
                            # ReasoningRisks/RecommendedActions/AIReview/Postmortem sections,
                            # HypothesisCard, ConfidenceIndicator, EvidenceReferenceChips,
                            # ReviewStatusControl, RunComparisonTable, SkepticReviewCard,
                            # EditableStringList, IncidentStatusSelector, ResolveIncidentDialog,
                            # AddEvidenceDialog, InvestigationProgressBanner, OutdatedAnalysisBanner
    components/common/     # ControlledTextField, CopyButton
    pages/                 # Route-level page components
    hooks/                 # React hooks (useIncident(s), useCreateIncident, useAnalyzeIncident,
                            # useReviewStatement, useRunSkepticReview, useUpdateSkepticReviewNotes,
                            # useGeneratePostmortem, useEditPostmortem, useUpdateIncidentStatus,
                            # useAddEvidence, ...)
    services/              # Typed API clients (incidentService, analysisService, postmortemService,
                            # evidenceService, ...)
    store/                 # Zustand: workspace UI state only (active tab, evidence search/filter)
    schemas/               # Frontend-only Zod schemas (New Incident, resolve-incident,
                            # add-evidence forms)
    constants/              # Routes, query keys, workspace section config
    theme/                 # MUI theme tokens
    utils/                 # File validation/size formatting, evidence/incident filtering/sorting/
                            # summarizing, reference-indexing, status-display mapping,
                            # buildPostmortemMarkdown, investigationProgress, analysisFreshness,
                            # applyOptimisticStatusUpdate
  server/                  # Backend application
    src/
      app.ts               # Express app factory (dependency-injectable repository + AI provider)
      server.ts            # HTTP listener entry point
      config/              # Environment configuration
      controllers/         # Request handlers
      routes/               # Route definitions
      middleware/           # Error handling, 404 handling, Multer upload, Zod body validation
      parsers/              # Text/JSON/CSV evidence parsers + extension dispatcher
      services/             # evidenceService, incidentService, analysisService,
                            # skepticReviewService, postmortemService, incidentLifecycleService
      schemas/              # Server-only request schemas (incident intake, statement review,
                            # skeptic review notes, postmortem edit, incident status update,
                            # evidence create)
      repositories/         # IncidentRepository interface + in-memory implementation
      data/incidents/       # Bundled synthetic sample incidents
      ai/
        providers/           # AIProvider interface, MockAIProvider, AnthropicAIProvider, factory
        prompts/              # Versioned prompts (incident-analysis-v1, skeptic-review-v1,
                              # postmortem-v1, repair-invalid-json-v1)
        schemas/              # AI-facing structured-output Zod schemas (analysis, skeptic
                              # review, postmortem)
        validators/           # JSON/schema validation, evidence-reference and unsupported-claim checks
        mapAnalysisResponse.ts       # Validated AI response -> persisted AnalysisRun
        mapSkepticReviewResponse.ts  # Validated AI response -> persisted SkepticReview
        mapPostmortemResponse.ts     # Validated AI response -> persisted Postmortem
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

To see the full loop: open the Dashboard — it lists every incident with a status summary and
search/filter controls, most recently updated first. Click "Start a new incident" (a breadcrumb
trail back to the Dashboard appears at the top of every page from here on), click "Load sample
incident" to prefill a realistic example, then "Save & analyze incident" — you'll land on that
incident's workspace with a real (mock, by default) analysis already run. From there: Overview
shows the summary/impact/uncertainty statement, Evidence is searchable/filterable, Timeline shows
chronological events with confidence-labeled timestamps, Hypotheses shows every candidate
explanation ranked by confidence with supporting/contradicting evidence, Facts & Assumptions lets
you mark any statement's review status, Reasoning Risks shows the biases this specific analysis
flagged about itself, Recommended Actions shows concrete next steps ordered by priority, AI Review
lets you run a skeptic review that challenges the leading hypothesis and record your own notes on
it, and Postmortem lets you generate a draft, edit any field in place, and export it as Markdown
(copy to clipboard or download). Clicking any evidence id chip anywhere jumps straight to that
evidence item. Click "Dashboard" in the breadcrumb (or the header nav) to go back — the incident
you just created now appears at the top of the list, and the status summary/filters reflect it
immediately.

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

497 tests total:

- **Backend** (`server/tests/`, 354 tests) — everything from prior stages, plus this pass's incident
  lifecycle and evidence-addition coverage: `computeResolvedAt`'s full transition matrix (resolve,
  reopen-clears, archive-preserves, archive-never-invents) and `updateIncidentStatus` (persists a
  resolution's notes, preserves them across a reopen that doesn't supply new ones, overwrites them
  when a request does, 404 for a missing incident); the `PATCH .../status` route end to end (valid
  transitions, rejects unsupported statuses *and* `"analyzing"` specifically, requires `resolvedAt`
  when resolving, the same lifecycle rules re-verified through the real HTTP layer, the standard API
  response envelope); `buildManualEvidenceItem` and the `POST .../evidence` route (every requested
  source type preserved exactly, optional timestamp defaults to `null`, ids always server-generated
  even if a client tries to supply one, rejects missing/invalid fields and whitespace-only content).
  `UserSelectableIncidentStatusSchema` is also directly tested to confirm it excludes `"analyzing"`.
- **Frontend** (`tests/`, 143 tests) — everything from prior stages, plus pure-logic coverage for
  every new derivation: `getInvestigationSteps` (each step's independent completion check, the
  first-incomplete-is-current rule, out-of-order completion such as a postmortem drafted before a
  skeptic review, and confirming status alone never drives progress -- a "resolved" incident with no
  evidence still leaves step 1 incomplete); `getAnalysisFreshness`/`getNewestEvidenceCreatedAt`
  (not-analyzed vs. outdated vs. up-to-date, a failed run never counting as "analyzed", a later
  successful run clearing a prior outdated state); and `applyOptimisticStatusUpdate` (mirrors the
  backend's transition rules for the optimistic cache update, including that it never mutates its
  input).

Full component-level React Testing Library tests remain out of scope for this project -- there is no
component-testing framework (RTL/jsdom) installed, and this pass deliberately did not add one rather
than change established test infrastructure as a side effect of a feature change. Concretely, this
means the *interactive* behavior of the new status menu, resolution/add-evidence dialogs, and
progress-banner navigation (opening a menu, cancelling a dialog, a disabled-while-pending button) is
verified by live smoke testing against a running server and by production-bundle content checks
(see below), not by an automated component test. Every derivation and mutation-adjacent computation
underneath that UI (see the two bullets above) is unit-tested directly. `AnthropicAIProvider` is
still not exercised against the live Anthropic API (no network calls in tests, no API key available
in this environment).

## Known limitations (final)

- The investigation progress banner's five steps are fixed and not reorderable/configurable; "Evaluate
  risks and skeptic review" requires *both* a reasoning risk and a skeptic review to be marked
  complete, which is intentional (matching the spec) but means an incident with only one of the two
  still shows that step as the current, incomplete one.
- The status selector's success/error feedback is a locally-managed Snackbar/inline Alert per
  component (matching the existing `CopyButton` precedent), not a shared, app-wide notification
  system -- there isn't one in this codebase to reuse, and introducing one was out of scope for this
  pass.
- No component-testing framework (React Testing Library/jsdom) is installed, so the *interactive*
  behavior of the new status menu, resolution dialog, add-evidence dialog, and progress-banner
  navigation is not covered by an automated test -- see "Testing" above for exactly what is and
  isn't covered, and why one wasn't added as a side effect of this change.
- The Dashboard's search/filter/sort is entirely client-side over the full incident list returned
  by `GET /api/incidents` — fine at this app's scale (a handful of bundled samples plus whatever a
  single user creates in a session), but wouldn't scale to a large, multi-user incident volume
  without server-side pagination/filtering.
- The incident table has one fixed sort order (most recently updated first); there is no
  clickable-column sort by title, status, or severity.
- A skeptic review or postmortem draft always applies to the incident's *latest* analysis run;
  there is no way to request either for an older run once a newer one exists, matching how every
  workspace tab treats "the latest run" as authoritative.
- Regenerating a postmortem draft fully discards any human edits already made (the "Regenerate"
  button is labeled to say so) — there is no diff/merge assistance between an old edited draft and
  a freshly regenerated one.
- Recommended Actions and open investigation questions are shown together in the same tab, but
  there is no id-level link between a specific action and a specific question — `openQuestions` is
  a plain `string[]` on `AnalysisRun`, not a list of objects with ids, matching the original data
  model. The connection is presentational (shown side by side), not a foreign key.
- Redaction of sensitive values before sending evidence to a real AI provider is still not
  implemented (unchanged from Stage 4) — evidence is sent to Anthropic as-is when
  `AI_PROVIDER=anthropic`.
- No full-page/component-level frontend test suite (React Testing Library) — deliberately out of
  scope for the full ten-stage plan (see "Testing" above), not merely deferred.
- No browser tool is available in this environment to click through the new Postmortem UI (or any
  UI, across all ten stages) — typecheck, lint, the full test suite, and a production build were
  all verified at every stage; this stage's live smoke test additionally confirmed the production
  bundle's route-level code-split chunk for the Incident Workspace actually contains the new
  Postmortem UI strings, and exercised the full generate → edit → regenerate lifecycle plus every
  error path (400 with no analysis yet, 400 with no draft yet to edit, 404 for a missing incident,
  400 for an invalid PATCH field type) against a running server.

## Roadmap

All ten planned stages are complete: shared models & mock data, incident input & file upload, AI
provider architecture, evidence workspace, timeline & hypotheses, reasoning-risk detection,
critical AI review, incident dashboard & navigation, postmortem export, and final testing/polish.
See "Known limitations" above for what's deliberately still out of scope.
