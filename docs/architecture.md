# IncidentIQ Architecture

This document describes how IncidentIQ is put together: the frontend/backend split, the shared
schema layer, the AI provider pipeline (including redaction, validation, and repair), the three AI
workflows (analysis, skeptic review, postmortem), human-in-the-loop review points, client-side
caching, security boundaries, and known prototype-level limitations.

Diagrams below are plain-text/ASCII rather than Mermaid: this project has no way to confirm Mermaid
actually renders wherever this document is read (a plain GitHub file view, a grading tool, a local
Markdown preview), so a plain-text diagram that is readable everywhere was chosen over one that
might silently fail to render.

## 1. High-level layout

```
+-------------------------------+        HTTP (JSON, /api/*)        +----------------------------------+
|  Frontend (src/)               |  <------------------------------> |  Backend (server/src/)            |
|  React + Vite + TypeScript     |                                    |  Express + TypeScript             |
|  MUI, TanStack Query, Zustand  |                                    |  AI providers, repository, parsers|
+-------------------------------+                                    +----------------------------------+
                \                                                              /
                 \                                                            /
                  +----------------------------------------------------------+
                  |                shared/ (Zod schemas + inferred types)     |
                  |   source of truth for every domain shape used by both     |
                  +----------------------------------------------------------+
```

The frontend never talks to Anthropic/OpenAI directly and never holds an API key. Every AI call is
made by the backend; the frontend only ever calls IncidentIQ's own `/api/*` routes.

## 2. Shared schema layer (`shared/`)

Every domain entity is defined exactly once as a Zod schema under `shared/schemas/`, with its
TypeScript type inferred (`z.infer<...>`) and re-exported from `shared/types/`. Both the frontend
and backend import from `shared/`, so a request/response/domain shape can never silently drift
between the two runtimes. Key schemas: `Incident`, `EvidenceItem`, `ReasoningItem` (fact/
assumption), `TimelineEvent`, `Hypothesis`, `BiasFinding`, `RecommendedAction`, `AnalysisRun`,
`SkepticReview`, `Postmortem`.

`shared/constants/` holds cross-cutting fixed values both runtimes need identically (the
evidence-field-to-source-type mapping for the New Incident form, file-upload limits/allowed
extensions/expected MIME types).

## 3. Backend request flow

```
HTTP request
   -> routes/ (incidentRoutes.ts, healthRoutes.ts)
   -> middleware/ (validateBody -- Zod parsing of the request body; upload.ts -- Multer, extension + MIME filtering)
   -> controllers/ (thin: extract params/body, call a service, shape the ApiResponse envelope)
   -> services/ (business logic: incidentService, evidenceService, analysisService,
                  skepticReviewService, postmortemService, incidentLifecycleService)
   -> repositories/ (IncidentRepository interface; InMemoryIncidentRepository the only
                      implementation today)
```

Every response uses one standard envelope, `{ success, data, error }` (`shared/types/apiResponse.ts`),
so the frontend has exactly one shape to unwrap regardless of endpoint. `middleware/errorHandler.ts`
converts a thrown `ApiError` (or an unexpected error) into that same envelope with an appropriate
HTTP status, so a route handler never has to format its own error response.

### Persistence

`IncidentRepository` is an interface; `InMemoryIncidentRepository` is the only implementation, seeded
at startup from the six bundled sample incidents (`server/src/data/incidents/`) and otherwise holding
whatever incidents/evidence/analysis runs/skeptic reviews/postmortems a running process has created.
Nothing is persisted to disk -- restarting the backend resets to the bundled samples. Every consumer
(services, controllers) depends only on the `IncidentRepository` interface, so a real database could
be substituted without touching calling code; this is a deliberate, documented prototype limitation
(see Section 9), not an oversight.

## 4. Evidence intake pipeline

Two entry points feed the same evidence pipeline:

1. **Pasted text** -- the New Incident form's seven category-specific fields, each line becoming its
   own evidence item (`parseTextContent`), or a single block for the incident description
   (`parseSingleBlock`). A leading bracketed timestamp (`[2026-06-14T14:28:00Z] ...`) is recognized
   and extracted if present.
2. **Uploaded files** (`.txt`, `.log`, `.json`, `.csv`; up to 2 MB each, 10 files per incident) -- kept
   in memory only (`multer.memoryStorage()`, never written to disk), filtered by `middleware/upload.ts`
   on **both** extension and MIME type before any parsing is attempted (a concrete MIME/extension
   mismatch is rejected; a generic/unknown MIME type like `application/octet-stream` is tolerated,
   since browsers report it inconsistently -- extension plus parser-level validation remain the
   authoritative checks). Dispatched by extension to `server/src/parsers/`:
   - `.txt`/`.log` -- one evidence item per non-empty line (`textParser.ts`); an empty or
     whitespace-only file is rejected server-side with a standard error, not merely blocked by
     frontend validation.
   - `.json` -- one evidence item per array element, or a single item for a top-level object
     (`jsonParser.ts`), with a best-effort timestamp extracted from a recognizable field.
   - `.csv` -- one evidence item per data row (`csvParser.ts`), using the header row as field names.
     A hand-rolled RFC-4180-style tokenizer correctly handles quoted fields containing commas and
     escaped `""` quotes. Validation beyond tokenization rejects: empty/blank header rows, duplicate
     headers, rows with an inconsistent column count relative to the header, and a file with no
     meaningful data rows -- each with a specific, user-facing error rather than a generic parse
     failure.

Every parser only ever reads file content as text, `JSON.parse`, or the CSV tokenizer -- uploaded
content is never evaluated or executed.

Once every evidence item for an incident exists, the server sorts timeline-eligible events
chronologically at persistence time (`mapAnalysisResponse.ts`, in addition to a defensive frontend
sort) and runs a timeline-plausibility validator (`timelinePlausibilityValidator.ts`) that produces
*warnings*, never rejections, for events far outside the incident's window, inferred timestamps
presented as exact, or invalid chronological relationships -- legitimate pre-incident evidence (a
deployment note from days before, for example) is never treated as automatically invalid.

## 5. AI provider architecture

```
analysisService / skepticReviewService / postmortemService
        |
        v
  AIProvider  (interface -- the only thing these services depend on)
        ^
        |  constructed once, injected, never chosen per-feature
        |
  createAIProvider(config)  <-- the ONLY place a concrete provider is selected
        |
        +--> MockAIProvider        (AI_PROVIDER=mock, default, offline, deterministic)
        +--> AnthropicAIProvider   (AI_PROVIDER=anthropic, real, needs ANTHROPIC_API_KEY)
        +--> OpenAIProvider        (AI_PROVIDER=openai, real, needs OPENAI_API_KEY)
```

`resolveProviderSelection` (pure) decides which of the three to build, including whether
`ALLOW_MOCK_FALLBACK=true` should substitute `MockAIProvider` for a misconfigured real provider --
in which case the resulting instance still reports `name: 'mock'` but also carries
`configuredProvider`, `fallbackUsed: true`, and a `fallbackReason`, so a fallback result is never
mistaken for genuine AI output anywhere it is persisted or displayed.

Real providers (`AnthropicAIProvider`, `OpenAIProvider`) only report `providerVerified: true` after
an actual successful call in that process's lifetime -- never merely because a key is configured.

### Redaction (external-provider payloads only)

Immediately before constructing the SDK request, `AnthropicAIProvider.complete`/`OpenAIProvider.complete`
call `redactPromptForExternalProvider` (`ai/redactSensitiveContent.ts`), which returns a **new**,
redacted `AIPrompt` -- the original prompt object, and the `Incident`/evidence it was built from, are
never mutated. Detected categories (see the file's doc comment for the exact patterns): email
addresses, bearer tokens, well-known API-key prefixes, password/secret/access-token/refresh-token/
session-id key-value pairs, authorization headers, cookie values, and card-number-shaped digit runs.
Only safe metadata is ever recorded or persisted: `redactionApplied`, `redactedValueCount`, and
`redactionCategories` -- never the removed values themselves. `MockAIProvider` never redacts, by
design: nothing it does leaves the process, so there is nothing external to protect against, and this
absence of redaction is itself part of how the architecture "clearly distinguishes external vs. local
behavior" between providers. This is explicitly a prototype-level safeguard, not a production data-loss-
prevention system -- see `docs/ethical-and-professional-risks.md`.

### Response validation and repair (two distinct passes)

1. **Schema-invalid-JSON repair** (`runProviderWithRetry.ts`, shared by all three AI workflows) -- if
   the provider's raw response is not valid JSON, or doesn't match the AI-facing Zod schema, exactly
   one repair request is sent (`repair-invalid-json-v1`) describing what was wrong. A second failure
   raises a controlled `AI_RESPONSE_INVALID` error; malformed data is never persisted or returned.
2. **Targeted completion-repair** (`analysisService.ts` only, analysis responses) -- once a response is
   schema-valid, `evaluateAnalysisQuality`/`identifyRepairableDeficiencies` check for specific
   *completeness* gaps (empty reasoning risks, empty recommended actions, every hypothesis missing
   contradicting evidence despite a rich evidence set, empty open questions, a trivial uncertainty
   statement). If any are found, exactly one further repair request is sent, containing the original
   response and the known evidence ids, asking only for the deficient sections. `mergeCompletionRepair`
   only ever adopts a named section (never `facts`/`summary`) and only when it demonstrably improved.
   If the repair call fails or its response is invalid, the original valid result is kept unchanged --
   there is no retry loop beyond this single attempt.

Evidence-integrity validation (`findUnknownEvidenceReferences`, `detectUnsupportedFacts`) then checks
every evidence id cited anywhere in the response (facts, timeline, hypotheses' supporting/
contradicting lists, reasoning risks, recommended actions) against the incident's real evidence set.
A "fact" whose only citation doesn't resolve is moved out of `facts` into `unsupportedClaims` (never
silently deleted, with a validation warning explaining why and the original evidence reference
preserved for audit) -- applied identically regardless of which provider produced the response.

### Mapping to persisted records

`mapAiResponseToAnalysisRun`/`mapAiResponseToSkepticReview`/`mapPostmortemResponse` convert a
validated AI-facing response into its persisted `shared/schemas/` shape: real ids are assigned to
every nested item (the AI never assigns its own), a hypothesis's AI-invented `tempId` is resolved to
its real id everywhere it's referenced, and every system-managed field (`reviewStatus: 'unreviewed'`,
`status: 'proposed'`/`'suggested'`) is force-set -- the AI cannot set these itself.

## 6. The three AI workflows

- **Analysis** (`POST /api/incidents/:id/analyze`) -- the primary pass: summary, timeline, facts,
  assumptions, at least three hypotheses, reasoning risks, recommended actions, open questions, an
  uncertainty statement. Currently uses prompt `incident-analysis-v2` (see `docs/prompts.md`; `v1` is
  preserved unchanged for the prompt-comparison experiment).
- **Skeptic review** (`POST /api/incidents/:id/skeptic-review`) -- a second, independent pass that
  critically challenges the *latest* analysis run's leading (highest-confidence) hypothesis, persisted
  as a new, separate `SkepticReview` record that never modifies the original run. The backend (not the
  model) computes which hypothesis is leading and which evidence the original run never cited, and
  supplies both directly in the prompt.
- **Postmortem** (`POST`/`PATCH /api/incidents/:id/postmortem`) -- drafts a full postmortem from the
  incident and its latest analysis run. Unlike the two append-only records above, a postmortem is a
  single evolving document: every field stays human-editable in place after the AI drafts it.
  Regenerating fully replaces the current draft (including prior edits, with a UI warning); editing
  merges changes and only bumps `lastEditedAt`.

All three share `runProviderWithRetry` for schema validation and the one-shot repair-on-invalid-JSON
retry, so extraction/validation/retry behavior is identical across every AI-facing prompt type.

## 7. Human-in-the-loop review points

- **Fact/assumption review status** -- `PATCH /api/incidents/:id/statements/:statementId/review` lets
  a human mark any fact or assumption supported, partially supported, unsupported, or rejected,
  independent of the AI's own confidence score.
- **Hypothesis status** -- `PATCH /api/incidents/:id/hypotheses/:hypothesisId/status`
  (`hypothesisController.ts`) is the *only* path that can transition a hypothesis's status, including
  to `confirmed-by-human`. The AI never sets this status itself (the AI-facing schema doesn't even
  expose the field); confirming specifically requires `confirmed: true` in the same request body,
  enforced by a Zod `.refine()` at the API boundary, not merely a frontend confirmation dialog. An
  optional `humanReviewNote` records the reviewer's reasoning alongside the transition.
- **Skeptic review notes** -- `PATCH /api/incidents/:id/skeptic-reviews/:reviewId/notes` lets a
  reviewer record their own take, stored separately from (and never overwriting) the AI-generated
  content.
- **Postmortem editing** -- every drafted field is directly human-editable, distinct from the
  append-only, AI-authored-plus-separate-notes model used for facts/hypotheses/skeptic reviews.

## 8. Frontend state and caching

TanStack Query owns every piece of server-derived state (incidents, analysis runs, evidence);
Zustand (`useWorkspaceStore`) holds only genuinely client-only UI state (the active workspace tab,
the evidence search text and type filter), reset whenever the user navigates to a different incident.
Nothing server-derived is duplicated into Zustand. Mutations that need to feel instant (status
updates, hypothesis-status updates) use an optimistic-update pattern: `onMutate` cancels in-flight
queries and snapshots the current cache value, a pure function applies the optimistic change,
`onError` rolls back from the snapshot, and `onSettled` invalidates the relevant queries -- mirrored
identically across every optimistic mutation in this codebase.

## 9. Security boundaries and known prototype limitations

- **API keys** are read only on the backend (`server/src/config/env.ts`), never bundled into
  frontend code, never logged, and never included in an error response -- the worst any diagnostic
  exposes is *whether* a key is configured, never any part of it.
- **Redaction is prototype-level**, not a production data-loss-prevention system: it targets specific,
  well-known secret shapes (see Section 5) rather than every possible sensitive-data pattern, and does
  not attempt entity recognition, PII classification, or context-aware redaction.
- **No real database** -- `InMemoryIncidentRepository` is the only persistence implementation; all
  data is lost on restart. The `IncidentRepository` interface exists specifically so this can change
  without touching calling code, but no real backing store is implemented today.
- **No authentication/authorization** -- every `/api/*` route is open to anyone who can reach the
  backend; there is no concept of a logged-in user, ownership, or per-user data isolation. This is a
  single-tenant prototype.
- **File uploads are held in memory only** for the duration of a request -- there is no persistent
  file storage, and re-fetching an incident never returns the original uploaded file, only the
  evidence items parsed out of it.
- **The critical-AI-experiment framework** (`docs/experiments/`) makes real, billable provider calls
  only when explicitly enabled (`RUN_REAL_AI_EXPERIMENTS=true`, a configured key, `--real`/`--provider`
  flags, and explicit approval) -- see that directory's `README.md` for the full safety contract.
