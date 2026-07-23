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
>
> **Compliance-closure pass (current).** A subsequent, evidence-audited pass closed the gaps recorded
> in `docs/requirements-compliance-audit.md`: unsupported facts are now moved out of `facts` into
> `unsupportedClaims` rather than silently dropped; a new `incident-analysis-v2` prompt plus a
> provider-independent quality gate and a targeted, at-most-once completion-repair pass address real,
> documented gaps found in prior real-OpenAI testing (empty reasoning risks, empty contradicting
> evidence); a human-only hypothesis-review workflow (including a `confirmed-by-human` status the AI
> can never set itself) was added; sensitive content is now redacted from every request sent to a real
> AI provider; file-upload validation was hardened (empty files, malformed CSVs, MIME/extension
> mismatches); all six bundled sample incidents now have evaluation fixtures; and a critical-AI
> experiment framework (`npm run ai:experiment`, see `docs/experiments/`) was added. See
> `docs/requirements-compliance-closure.md` for the full, itemized before/after record, and
> `docs/reflective-report.md` for the project's reflective account. **Not done as part of this pass:
> recording the project's demo video** -- see "Demo" below.

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
  `503 AI_PROVIDER_NOT_CONFIGURED` error explaining how to switch back to `mock` — it never crashes
  the app at startup, and it never silently returns mock output instead. Failures from the SDK are
  translated into distinct controlled errors rather than one generic message: authentication/
  permission failures → `401 AI_PROVIDER_AUTH_FAILED`, rate limiting → `429
  AI_PROVIDER_RATE_LIMITED`, network failures → `502 AI_PROVIDER_NETWORK_ERROR`, anything else the
  SDK rejects with → `502 AI_PROVIDER_ERROR`. Transient/network failures get two automatic retries
  at the SDK transport layer (`maxRetries: 2`) before surfacing as a controlled error — a separate
  concern from `runProviderWithRetry`'s one-shot repair retry for malformed JSON *output* below. A
  provider instance only reports `providerVerified: true` after at least one real Anthropic call has
  actually succeeded in that process's lifetime.
- **`OpenAIProvider`** — the real provider for `AI_PROVIDER=openai`, backed by the OpenAI Responses
  API (`client.responses.create`, reading `response.output_text`). Structurally a mirror of
  `AnthropicAIProvider`: same lazy key check and `503 AI_PROVIDER_NOT_CONFIGURED` on first use, same
  translated error taxonomy (`401 AI_PROVIDER_AUTH_FAILED` for auth/permission failures, `429
  AI_PROVIDER_RATE_LIMITED` for rate limits, a distinct `429 AI_PROVIDER_QUOTA_EXCEEDED` for a
  billing/quota failure specifically -- OpenAI reports both as HTTP 429, distinguished here by the
  SDK error's own `code: 'insufficient_quota'`, `502 AI_PROVIDER_NETWORK_ERROR` for connection/timeout
  failures, `502 AI_PROVIDER_ERROR` for invalid requests and 5xx provider errors), an explicit
  request timeout (60s) plus `maxRetries: 2` at the SDK transport layer, and the same
  `providerVerified`/one-request-id-per-completed-call tracking. Two failure modes it additionally
  distinguishes, since the Responses API can produce them directly: a response left `incomplete`
  (e.g. truncated by `max_output_tokens`) and an explicit model **refusal** (a distinct `502
  AI_PROVIDER_REFUSED`, never conflated with an ordinary empty response). Whenever the SDK exposes
  one, the response's safe request id (`x-request-id`, not an auth header) is attached to both error
  details and successful-run metadata (`providerRequestId`) for support/debugging purposes.

  **On Structured Outputs:** the `openai` SDK can constrain a response to a Zod schema
  (`zodTextFormat` + `responses.parse`), which was evaluated for this feature and found directly
  incompatible with this codebase's existing AI-facing schemas: `AiHypothesisSchema.status` is
  `z.literal('proposed').optional()`, and OpenAI's strict-mode JSON Schema requires every property to
  be in `required` (the installed SDK's own schema-conversion helper throws synchronously on this,
  confirmed by direct inspection rather than assumed); separately, `AiAnalysisResponseSchema` has a
  top-level `.refine()` enforcing hypothesis-`tempId` uniqueness, an invariant with no JSON Schema
  representation at all. A hand-written adapter schema could dodge both, but every AI-facing schema
  already describes its required shape to the model in natural language inside its own versioned
  prompt (the same technique `MockAIProvider` and `AnthropicAIProvider` already rely on), and the
  domain Zod schema -- refinement included -- is the sole, unweakened validation authority for every
  provider regardless. A parallel adapter schema would only marginally reduce how often the existing
  one-shot repair retry is needed, at the cost of a second schema per AI flow to hand-maintain and a
  new version-coupling risk isolated to this one provider. `OpenAIProvider` therefore sends its
  prompt as plain text and returns the raw response, exactly like `AnthropicAIProvider` -- see the
  doc comment atop `ai/providers/OpenAIProvider.ts` for the full reasoning.
- **Centralized provider selection** (`ai/providers/createAIProvider.ts`, backed by the pure
  `resolveProviderSelection.ts`) is the single place that decides mock vs. Anthropic vs. OpenAI --
  every AI flow (analysis, skeptic review, postmortem) is constructed once in `createApp()` and
  receives the same injected provider instance; none of them instantiate a provider directly.
  `AI_PROVIDER=mock` never needs a key. `AI_PROVIDER=anthropic`/`AI_PROVIDER=openai` with their
  matching key configured use `AnthropicAIProvider`/`OpenAIProvider` for real. If the configured
  provider's key is missing or empty, the app does **not** silently fall back to mock: it keeps using
  the real provider class, which raises `AI_PROVIDER_NOT_CONFIGURED` on the first real request. The
  only way to get mock output while `AI_PROVIDER` is `anthropic`/`openai` is to explicitly set
  `ALLOW_MOCK_FALLBACK=true` — when that fallback is taken, the resulting `MockAIProvider` instance
  carries `configuredProvider: 'anthropic'|'openai'`, `fallbackUsed: true`, and a `fallbackReason`
  explaining why, and every run/review/postmortem it produces is recorded with those same fields (in
  addition to `provider: 'mock'`), so a fallback result is never mistaken for a real AI-generated one.
- **Versioned prompts** (`ai/prompts/`) — `incident-analysis-v1` builds the system/user prompt from
  the incident and its evidence (each item labeled with its exact id so the model can cite it);
  `incident-analysis-v2` is the current production default, adding stronger, explicit instructions
  (actively search for contradicting evidence per hypothesis, ground reasoning risks in the specific
  incident, require concrete evidence/hypothesis-linked recommended actions) targeting real gaps
  found in prior real-OpenAI testing -- `v1` is preserved unchanged for prompt-comparison experiments
  (`docs/experiments/`), not used in normal operation; `repair-invalid-json-v1` is a one-shot
  correction prompt used only when a response fails schema validation;
  `targeted-completion-repair-v1` is a separate, at-most-once repair pass for a response that is
  schema-valid but incomplete (empty reasoning risks, empty recommended actions, etc. -- see
  `docs/prompts.md` for the full list and rules of each prompt).
- **Structured output schema** (`ai/schemas/aiAnalysisResponse.schema.ts`) — a Zod schema distinct
  from the persisted `AnalysisRun`/`Hypothesis`/etc. schemas in `shared/schemas/`: every
  system-managed field (`id`, `reviewStatus`, a hypothesis's lifecycle `status`) is omitted, since
  the AI must never assign them. Hypotheses instead carry a model-invented `tempId` (`"H1"`, `"H2"`,
  …) so `recommendedActions` can forward-reference a hypothesis before real ids exist; at least
  three hypotheses and at least one evidence id per fact are enforced by the schema itself, not
  just prompt instructions.
- **Validation** (`ai/validators/`) — `validateAIResponse` extracts JSON (tolerating a stray
  markdown code fence) and validates it against the schema; `findUnknownEvidenceReferences` flags
  any cited evidence id that isn't real, checked across every reference-bearing field (facts,
  timeline, hypotheses' supporting/contradicting lists, reasoning risks, recommended actions);
  `detectUnsupportedFacts` demotes a "fact" whose only cited evidence turned out to be invalid --
  moved into `unsupportedClaims` with a validation warning explaining why, never silently deleted,
  and applied identically across mock and real providers; `analysisQualityEvaluator.ts` is a
  separate, provider-independent *quality* gate (never invalidates a response -- an incident can
  legitimately have no contradicting evidence or no detectable bias) that surfaces completeness and
  quality warnings for a human to see; `timelinePlausibilityValidator.ts` warns (never rejects) on
  implausible event timestamps.
- **Retry** — an invalid response (bad JSON or a schema mismatch) is retried exactly once with a
  repair prompt describing what was wrong. A second failure raises a controlled `AI_RESPONSE_INVALID`
  error rather than ever persisting or returning malformed data. Separately, a schema-*valid* but
  *incomplete* analysis response (see the quality gate above) gets at most one additional targeted
  completion-repair request limited to the deficient sections -- `facts` and `summary` are never
  altered by this pass, and there is no further retry beyond it either way.
- **`mapAiResponseToAnalysisRun`** — converts the validated response into a persisted
  `AnalysisRun`: assigns real ids to every nested item, resolves each `tempId` to its real
  hypothesis id (dropping and warning on any that don't resolve), force-sets
  `reviewStatus: 'unreviewed'` and `status: 'proposed'`/`'suggested'`, and records every warning
  found above.
- **Run metadata** — every `AnalysisRun` records `provider`, `model`, `promptVersion` (which one
  actually produced the result — the retry's `repair-invalid-json-v1` if a repair was needed),
  `durationMs`, and `inputHash` (a SHA-256 of the exact evidence set analyzed, order-independent).
  It also records `configuredProvider`, `fallbackUsed`, `fallbackReason`, and `providerRequestId`,
  copied directly from the injected `AIProvider` instance — the first three are always present and
  always equal `provider`/`false`/`null` for a normal run, and only differ when `ALLOW_MOCK_FALLBACK`
  actually caused a substitution (see below); `providerRequestId` is the provider's own safe request
  id when it exposes one (currently only `OpenAIProvider` does) and `null` otherwise. `SkepticReview`
  and `Postmortem` records carry the same four fields for the same reason.

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

### Human hypothesis review

`PATCH /api/incidents/:incidentId/hypotheses/:hypothesisId/status`
(`server/src/controllers/hypothesisController.ts`) is the one and only path that can transition a
hypothesis's status, including to `confirmed-by-human` -- the AI-facing schema doesn't even expose
that status value, so the AI cannot set it even indirectly. Setting `status` to `confirmed-by-human`
additionally requires `confirmed: true` in the same request body, enforced by a Zod `.refine()` at
the API boundary (`hypothesisStatusUpdate.schema.ts`), not merely a frontend dialog. An optional
`humanReviewNote` records the reviewer's own reasoning; `reviewedAt`/`previousStatus`/`newStatus` are
recorded alongside the transition. The Hypotheses tab's status control opens a confirmation dialog
before confirming specifically, explaining that this records a human conclusion, not an AI one. The
frontend mutation (`useUpdateHypothesisStatus`) applies an optimistic update with rollback-on-error,
matching the pattern already used for incident status updates.

### Privacy and redaction

Before a request reaches a real AI provider (`AnthropicAIProvider`/`OpenAIProvider`), its prompt
passes through `redactPromptForExternalProvider` (`ai/redactSensitiveContent.ts`), which returns a
brand-new, redacted `AIPrompt` -- the original prompt object, and the incident/evidence it was built
from, are never mutated, so everything stored locally and shown in the UI remains the original,
unredacted text. Detected categories: email addresses, bearer tokens, well-known API-key prefixes
(`sk-`/`pk-`/`AKIA`/`ghp_`/`xox...`), password/secret/access-token/refresh-token/session-id
key-value pairs, `Authorization`/`Cookie` headers, and card-number-shaped digit runs. Only safe
metadata is ever recorded -- `redactionApplied`, `redactedValueCount`, `redactionCategories` -- never
the removed values themselves; these three fields are part of the `AIProvider` interface and are
recorded on every `AnalysisRun`/`SkepticReview`/`Postmortem`, always `false`/`0`/`[]` for
`MockAIProvider` (which never sends anything externally and may use the original synthetic evidence
as-is -- this absence of redaction is itself part of how the architecture distinguishes external vs.
local behavior). This is explicitly a **prototype-level safeguard** against common accidental leaks,
not a production data-loss-prevention system -- see `docs/ethical-and-professional-risks.md` for the
documented limitation in full.

### Critical AI experiments

`npm run ai:experiment` (`server/src/experiments/`) is a repeatable, safe harness for comparing AI
behavior: prompt v1 vs. v2, mock vs. a real provider, a "prompt sensitivity" variant that argues
against the first apparent cause, and skeptic-review quality against six fixed criteria. It is never
wired into `npm test` and makes a real, billable provider call only when `--real`, `--provider=...`,
`RUN_REAL_AI_EXPERIMENTS=true`, a configured API key, and explicit approval (`--yes` or an
interactive confirmation showing the exact call count) are **all** present -- otherwise every
experiment still completes in mock-only mode and honestly records the real-provider leg as
`"not-run"`, with the specific reason, rather than inventing or silently omitting it. Results are
saved to `docs/experiments/<experiment>/latest.{json,md}`, overwriting the previous run. See
`docs/experiments/README.md` for the full contract, including why two of the four experiments are
only meaningful with a real provider (`MockAIProvider` ignores prompt text by design).

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
  result, and status. The AI can only ever leave a hypothesis `proposed` -- a status control lets a
  human reviewer explicitly transition it to `testing`/`supported`/`weakened`/`rejected`, or, via a
  confirmation dialog requiring an explicit `confirmed: true` and an optional note, to
  `confirmed-by-human` (`PATCH .../hypotheses/:hypothesisId/status`; see "Human hypothesis review"
  below) -- the AI can never set that status itself, at either the frontend or backend layer.
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

`server/src/data/incidents/` ships six realistic, deliberately ambiguous synthetic incidents
(e-commerce checkout failure, course-registration slowdown, mobile login failure, database
connection leak, payment-gateway timeout, async-queue backlog) — each with 8+ evidence items mixing
plausible causes, red herrings, and contradictory signals, so no single log line gives away the root
cause. Every one of the six has a matching evaluation fixture
(`server/tests/fixtures/scenarioEvaluations/`) recording its expected facts, at least three plausible
hypotheses (including a deliberate evidence-contradicted decoy), which evidence should challenge the
leading explanation, distracting/missing-information evidence, and expected reasoning risks -- used
by `scenarioEvaluations.test.ts` to keep every scenario's ambiguity and evidence-grounding
machine-checked, not just asserted in prose. `server/src/repositories/` defines an `IncidentRepository`
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
path), validated on **both** extension and MIME type (`middleware/upload.ts` -- a concrete mismatch
like an image uploaded as `.txt` is rejected; a generic/unknown MIME type like
`application/octet-stream` is tolerated, since browsers report it inconsistently, and extension plus
parser-level validation remain the authoritative checks), and dispatched by extension to a dedicated
parser:

- **`.txt` / `.log`** — one evidence item per non-empty line. An empty or whitespace-only file is
  rejected server-side (not merely by frontend validation) with a standard error.
- **`.json`** — one evidence item per array element (or a single item for a top-level object),
  with a best-effort timestamp extracted from a recognizable field.
- **`.csv`** — one evidence item per data row, using a hand-rolled RFC-4180-style tokenizer that
  correctly handles quoted fields containing commas and escaped `""` quotes. Rejected with a clear,
  specific error: empty/blank header rows, duplicate headers, rows with an inconsistent column count
  relative to the header, and a file with no meaningful data rows at all.

Every parser only ever reads file content as text or parses it with `JSON.parse` / the CSV
tokenizer — uploaded content is never evaluated or executed. All evidence extraction (both pasted
text and uploaded files) is exercised end-to-end by `POST /api/incidents`, which creates the
incident and its full evidence list in one request. Timeline-eligible evidence is sorted
chronologically at persistence time (`mapAnalysisResponse.ts`, not only defensively on the frontend),
and a timeline-plausibility validator produces *warnings* (never rejections) for events far outside
the incident's window, inferred timestamps presented as exact, or invalid chronological relationships
-- legitimate pre-incident/historical evidence is never treated as automatically invalid.

## Technology stack

| Layer    | Technology                                                                 |
| -------- | --------------------------------------------------------------------------- |
| Frontend | React, Vite, TypeScript (strict), React Router, Material UI, TanStack Query, Zustand, React Hook Form, Zod |
| Backend  | Node.js, Express, TypeScript (strict), CORS, dotenv, Zod, Multer, Anthropic SDK, OpenAI SDK |
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
        providers/           # AIProvider interface, MockAIProvider, AnthropicAIProvider, OpenAIProvider, factory
        prompts/              # Versioned prompts (incident-analysis-v1, skeptic-review-v1,
                              # postmortem-v1, repair-invalid-json-v1)
        schemas/              # AI-facing structured-output Zod schemas (analysis, skeptic
                              # review, postmortem)
        validators/           # JSON/schema validation, evidence-reference and unsupported-claim checks
        mapAnalysisResponse.ts       # Validated AI response -> persisted AnalysisRun
        mapSkepticReviewResponse.ts  # Validated AI response -> persisted SkepticReview
        mapPostmortemResponse.ts     # Validated AI response -> persisted Postmortem
        runProviderWithRetry.ts      # Shared validate-then-retry-once orchestration
        redactSensitiveContent.ts    # Redaction applied to real-provider request payloads only
        mergeCompletionRepair.ts     # Merges a targeted completion-repair response, facts/summary untouched
      experiments/           # Critical-AI experiment framework (npm run ai:experiment), see docs/experiments/
      utils/                # ApiError, id generation, text normalization, input hashing
    tests/                 # Vitest + Supertest (schemas, parsers, services, AI pipeline, API routes, experiments)
  shared/
    schemas/               # Zod schemas (source of truth for every domain model)
    types/                 # TypeScript types inferred from the Zod schemas
    constants/              # File-upload limits, evidence-field-to-source-type mapping
  tests/                   # Frontend pure-logic Vitest tests (schemas, utils, store)
  docs/                    # requirements-compliance-audit.md/-closure.md, architecture.md, prompts.md,
                            # ai-tools-and-apis.md, ethical-and-professional-risks.md,
                            # bias-and-fallacy-analysis.md, demo-script.md, reflective-report.md,
                            # experiments/ (critical-AI-experiment output)
  examples/                # Synthetic, schema-valid example incident/analysis/review/postmortem artifacts
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
| `AI_PROVIDER`          | backend  | `mock` (default, offline, deterministic), `anthropic`, or `openai` (real analysis). Any other value fails fast at startup with a clear config error. |
| `ANTHROPIC_API_KEY`    | backend  | Only required when `AI_PROVIDER=anthropic`. Never committed. Missing/empty key → clear `503 AI_PROVIDER_NOT_CONFIGURED` on first AI request, not a crash, and never a silent switch to mock output. |
| `ANTHROPIC_MODEL`      | backend  | Optional; which Anthropic model to call. Defaults to `claude-sonnet-5`. |
| `OPENAI_API_KEY`       | backend  | Only required when `AI_PROVIDER=openai`. Never committed. Missing/empty key → clear `503 AI_PROVIDER_NOT_CONFIGURED` on first AI request, not a crash, and never a silent switch to mock output. |
| `OPENAI_MODEL`         | backend  | Optional; which OpenAI model to call. Defaults to `gpt-5.1`. |
| `ALLOW_MOCK_FALLBACK`  | backend  | `true` or `false` (default `false`; any other value fails fast at startup). When `true` *and* `AI_PROVIDER` is `anthropic`/`openai` *and* that provider's key is missing, AI requests are served by `MockAIProvider` instead of erroring — every such result is recorded with `provider: 'mock'`, `configuredProvider: 'anthropic'|'openai'`, `fallbackUsed: true`, and a `fallbackReason`, so it's never mistaken for real output. |
| `VITE_API_BASE_URL`    | frontend | Base URL the frontend uses to reach the backend (default `http://localhost:4001`). |
| `RUN_REAL_AI_EXPERIMENTS` | backend (experiments only) | Must be exactly `true` for `npm run ai:experiment -- --real ...` to make any real, billable provider call. Never read by the main application -- see `docs/experiments/README.md`. |

The backend loads `.env` from the repository root (`server/src/config/env.ts`, via `dotenv`) before
anything else reads `process.env` — the config module is imported first by every route/service/
provider-factory, so this works identically regardless of which npm script or working directory
started the process. All values are validated by a Zod schema at module load: a genuinely invalid
`AI_PROVIDER` or `ALLOW_MOCK_FALLBACK` value crashes startup immediately with a readable error; a
missing/empty `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` is never a validation failure, since "no key
configured" is a valid, expected state handled downstream by provider selection (see above). Both
provider API keys are read only on the backend, are never bundled into frontend code, and are never
written to logs or included in any error response — the worst any error/diagnostic exposes is
*whether* the currently-configured provider's key is present (`apiKeyConfigured: true`/`false`),
never any part of the key itself, and never a key belonging to a provider that isn't even selected
(e.g. a leftover `ANTHROPIC_API_KEY` while `AI_PROVIDER=openai` is never reported as "configured").

> If the backend fails to start with an "address already in use" error, another process on your
> machine already holds that port. Change `PORT` (and update `VITE_API_BASE_URL` to match) in
> `.env` and restart.

### Health and diagnostics

`GET /api/health` reports server liveness plus AI provider diagnostics, without ever making a paid
API request to Anthropic or OpenAI just to answer a health check and without ever exposing a key:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "incident-iq-api",
    "environment": "development",
    "uptimeSeconds": 12.3,
    "timestamp": "2026-07-21T12:00:00.000Z",
    "ai": {
      "configuredProvider": "openai",
      "apiKeyConfigured": true,
      "configuredModel": "gpt-5.1",
      "mockFallbackEnabled": false,
      "providerVerified": false
    }
  },
  "error": null
}
```

`apiKeyConfigured` only means a key is present — it says nothing about whether that key is actually
valid. `configuredModel` is the model configured for whichever provider `configuredProvider` names
(`null` for `mock`, which has no configurable model). `providerVerified` starts `false` (or `null`
under `AI_PROVIDER=mock`, where there's no external API to verify) and only becomes `true` after the
running process has completed at least one real, successful call to the configured provider — i.e.
the server having started successfully is never treated as proof the integration works.

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

### Manual verification: mock vs. real Anthropic/OpenAI

**Mock mode** (default, no key needed) — in `.env`:

```
AI_PROVIDER=mock
```

Start the app with `npm run dev`, open an incident, and run analysis / skeptic review / postmortem
from the UI as usual, or via the API directly (`POST /api/incidents/:id/analyze`, etc.). Every
result's `provider` field reads `"mock"`.

**Anthropic mode** — add your own key to your local `.env` (never paste a real key into a chat with
an AI assistant, a commit, or any tracked file):

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...your real key...
ALLOW_MOCK_FALLBACK=false
```

**OpenAI mode** — same idea, in your local `.env`:

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...your real key...
OPENAI_MODEL=gpt-5.1
ALLOW_MOCK_FALLBACK=false
```

Steps (identical for either provider, substitute the `AI_PROVIDER`/`*_API_KEY` values above):

1. `cp .env.example .env` if you haven't already, then edit the relevant lines above directly in your
   local `.env` file (it's gitignored — `git check-ignore .env` confirms this).
2. Restart the backend so it picks up the change: `npm run dev` (or `npm run dev:server`).
3. `curl http://localhost:4001/api/health` and confirm `data.ai.configuredProvider` matches what you
   set and `data.ai.apiKeyConfigured` is `true`. At this point `providerVerified` is still `false` —
   that's expected, since health checks never place a paid call themselves.
4. Run one real AI operation for each of the three workflows — e.g. from the UI: "Analyze", then "Run
   skeptic review", then "Generate postmortem"; or via the API directly:
   ```bash
   curl -X POST http://localhost:4001/api/incidents/<incidentId>/analyze
   curl -X POST http://localhost:4001/api/incidents/<incidentId>/skeptic-review
   curl -X POST http://localhost:4001/api/incidents/<incidentId>/postmortem
   ```
5. For each response, confirm `data.provider` (or `data.postmortem.provider`) is `"anthropic"`/
   `"openai"` (not `"mock"`), and that `configuredProvider` matches with `fallbackUsed: false`. This
   is the only thing that actually proves the integration works — the server starting, or the health
   check returning `200`, does not.
6. Optionally re-check `/api/health` — `data.ai.providerVerified` is now `true` for the remainder of
   that server process, since a real call has succeeded.

If the key is wrong, step 4 returns `401 AI_PROVIDER_AUTH_FAILED` with no retry and no silent
fallback to mock (unless you set `ALLOW_MOCK_FALLBACK=true`, in which case the result still comes
back but is honestly labeled `provider: "mock"`, `fallbackUsed: true`).

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

858 tests total (709 backend, 149 frontend) as of the compliance-closure pass -- run `npm run test`
to reproduce this count. The historical breakdown below (497 tests as of Stage 10/post-Stage-10
polish) is preserved for context; the compliance-closure pass on top of it added coverage for:
unsupported-fact handling and category-aware evidence validation; the `v2` prompt, quality gate, and
completion-repair pass; the human hypothesis-review route/service/schema, frontend and backend;
redaction (unit tests per category, both real providers); file-upload hardening (empty files,
malformed CSVs, MIME/extension mismatches); server-side timeline sorting and the plausibility
validator; evaluation fixtures for all six sample incidents; and the critical-AI-experiment
framework's pure logic (the real-call safety gate, run/format/comparison helpers, and the six
skeptic-review criteria) -- see `docs/requirements-compliance-closure.md` for the itemized record of
what changed and why.

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
underneath that UI (see the two bullets above) is unit-tested directly. `AnthropicAIProvider` and
`OpenAIProvider` both have thorough unit coverage against a mocked `@anthropic-ai/sdk`/`openai`
client respectively (auth/permission/rate-limit/quota/network/timeout/generic failure mapping, retry
and timeout configuration, `providerVerified` tracking, key-leak checks; `OpenAIProvider`'s suite
additionally covers incomplete responses and explicit model refusals, failure modes specific to the
Responses API) but neither is exercised against its *live* API — the regular test suite intentionally
makes no real network calls and requires no API key for either provider. See "Manual verification"
below for how to confirm the real integration works end to end with your own key.

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
- Redaction before sending evidence to a real AI provider (see "Privacy and redaction" above) is
  explicitly a **prototype-level** safeguard: it targets specific, well-known secret shapes by
  regular expression, not full PII/entity recognition or context-aware redaction. See
  `docs/ethical-and-professional-risks.md` for the full, honest limitation.
- No full-page/component-level frontend test suite (React Testing Library) — deliberately out of
  scope for the full ten-stage plan (see "Testing" above), not merely deferred.
- Real-provider verification exists only for OpenAI (a prior development session's manual testing,
  documented in `docs/requirements-compliance-audit.md`); Anthropic is architecturally supported and
  unit-tested against a mocked SDK client, but has no equivalent real-call verification recorded.
- Two of the eight schema-supported reasoning-risk types (`overconfidence-bias`, `hindsight-bias`)
  have no deterministic `MockAIProvider` heuristic and so cannot be demonstrated without a real
  provider call -- see `docs/bias-and-fallacy-analysis.md`.
- There is no authentication/authorization -- every `/api/*` route is open to anyone who can reach
  the backend; this is a single-tenant prototype, stated explicitly rather than assumed obvious.
- No browser tool is available in this environment to click through the new Postmortem UI (or any
  UI, across all ten stages) — typecheck, lint, the full test suite, and a production build were
  all verified at every stage; this stage's live smoke test additionally confirmed the production
  bundle's route-level code-split chunk for the Incident Workspace actually contains the new
  Postmortem UI strings, and exercised the full generate → edit → regenerate lifecycle plus every
  error path (400 with no analysis yet, 400 with no draft yet to edit, 404 for a missing incident,
  400 for an invalid PATCH field type) against a running server.

## Documentation

| Document | Contents |
| --- | --- |
| `docs/architecture.md` | Full system architecture: frontend/backend/shared layers, the AI provider pipeline, redaction, validation/repair, the three AI workflows, human-in-the-loop points, caching, security boundaries, and prototype limitations. |
| `docs/prompts.md` | Every AI prompt used at runtime: purpose, inputs, expected output, safety rules, and version history. |
| `docs/ai-tools-and-apis.md` | Every AI tool/API involved in building and running this project (OpenAI, Anthropic, Mock, Claude Code as a development aid), what each was verified to do, and what wasn't. |
| `docs/ethical-and-professional-risks.md` | Over-trust, definitive-root-cause claims, uncertainty communication, what should never be sent externally, private-data protection, responsibility for harmful recommendations, and supporting (not replacing) human judgment. |
| `docs/bias-and-fallacy-analysis.md` | Six of the eight schema-supported biases/fallacies in depth, with concrete sample-scenario examples and an honest account of what real-provider testing did and did not surface. |
| `docs/experiments/README.md` | The critical-AI experiment framework's four experiments, real-call safety contract, and current (mock-only) results. |
| `docs/demo-script.md` | The planned walkthrough for the (not yet recorded) demo video. |
| `examples/README.md` | Synthetic, schema-valid example incident/analysis/skeptic-review/postmortem artifacts. |
| `docs/requirements-compliance-audit.md` | The original, evidence-based compliance audit this closure pass was driven by. |
| `docs/requirements-compliance-closure.md` | The itemized before/after record of what this compliance-closure pass resolved, improved, or left as a documented limitation. |
| `docs/reflective-report.md` | The project's reflective report. |

## Demo

Demo video: **to be recorded.** See `docs/demo-script.md` for the planned walkthrough (scenario,
screen-by-screen talking points, and timing). No video exists yet -- this section will be updated
with a real link once one is recorded; until then, no claim is made that a demo video exists.

## Roadmap

All ten originally planned stages are complete: shared models & mock data, incident input & file
upload, AI provider architecture, evidence workspace, timeline & hypotheses, reasoning-risk
detection, critical AI review, incident dashboard & navigation, postmortem export, and final
testing/polish. A subsequent compliance-closure pass (see the status note near the top of this file)
addressed every code-level gap recorded in `docs/requirements-compliance-audit.md` and added the
documentation, example artifacts, and critical-AI-experiment framework referenced above. See "Known
limitations" for what remains deliberately out of scope, and `docs/requirements-compliance-closure.md`
for future-improvement recommendations tied to specific, still-open audit items.
