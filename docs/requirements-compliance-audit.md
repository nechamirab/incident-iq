# IncidentIQ Requirements Compliance Audit

## Audit Metadata

| Field | Value |
|---|---|
| Audit date | 2026-07-23 |
| Repository branch | `main` |
| Audited commit hash | `5daa4f5b92094c69e5f09a40de4e8f962b8fccb7` |
| Audit type | Read-only, evidence-based (no source, tests, configuration, dependencies, prompts, environment files, or Git history were modified) |
| Final verdict | **READY FOR DEMO, REPORT STILL REQUIRED** |
| Overall readiness estimate | ~70% (weighted: 60% mandatory compliance, 15% strong-scope, 25% submission deliverables) |
| Mandatory-requirement completion | 79% strict (45/57 PASS); ~85% if partial-credit is given to PARTIAL items |
| Strong-scope completion | 100% (4/4) |
| Submission-deliverable completion | 30% (3/10) |

**Scope note:** No separate written project brief was available in the repository or elsewhere. This audit uses the detailed audit specification supplied for this task as the authoritative statement of requirements, since it is the only available source, and evaluates the repository against it item by item.

**Status values used throughout:** `PASS`, `PARTIAL`, `FAIL`, `NOT VERIFIED`, `NOT APPLICABLE`.

**Classification values used throughout:** Mandatory Brief Requirement (MBR), Strong-Scope Recommendation (SSR), Advanced/Optional Feature (AOF), Suggested Technology (ST), Submission Deliverable (SD), Report-Only Requirement (RO).

---

## 1. Executive Summary

- **Overall readiness (weighted estimate):** ~70%.
- **Mandatory-requirement completion:** 45 PASS / 57 scored mandatory items = 79% strictly (PASS-only); ~85% if partial items are counted at half credit.
- **Strong-scope completion:** 4/4 = 100%.
- **Submission-deliverable completion:** 3/10 = 30%.
- **Totals across all 73 scored items:** 52 PASS · 9 PARTIAL · 10 FAIL · 1 NOT VERIFIED · 1 NOT APPLICABLE.

**Critical blockers (before final submission):**
1. No reflective report exists anywhere in the repository.
2. No demo video or link to one exists anywhere in the repository.
3. No example input/output artifacts exist.
4. No documented critical-AI experiments (prompt comparison, model comparison, prompt-sensitivity testing, hallucination/overconfidence records) exist anywhere in the repository.

**High-priority code/architecture gaps:**
- No reachable code path exists for a human to explicitly confirm a hypothesis (the AI-side block is implemented; the human-side action is not).
- No redaction of sensitive evidence occurs before it is sent to a real AI provider (this is self-disclosed honestly in the README's known-limitations section).
- Real-provider output, as verified in a prior session's manual testing, under-populated `reasoningRisks` and `contradictingEvidenceIds` relative to what the architecture supports and the prompts request.

**Summary judgment:** The codebase itself is in strong, genuinely tested shape. It is not ready for final submission solely because the non-code deliverables — reflective report, demo video, example artifacts, and documented critical-AI experiments — do not yet exist in the repository, not because of any code defect.

---

## 2. Repository and Architecture Overview

### Technology stack found (compared to likely suggested technologies; no alternative-but-suitable technology choice is treated as a failure)

| Layer | Technology | Evidence |
|---|---|---|
| Frontend | React + Vite + TypeScript, Material UI, TanStack Query, React Router, React Hook Form + Zod | `package.json`, `src/` structure |
| Backend | Node.js + Express + TypeScript (strict) | `server/package.json`, `server/src/` |
| Shared model | Zod schemas (source of truth) + inferred TypeScript types | `shared/schemas/`, `shared/types/` |
| AI providers | Mock (deterministic), Anthropic SDK (`@anthropic-ai/sdk`), OpenAI SDK (`openai`, Responses API) | `server/src/ai/providers/` |
| Persistence | In-memory repository (no database) — a reasonable prototype-scope choice | `server/src/repositories/InMemoryIncidentRepository.ts` |
| File upload | Multer (memory storage) | `server/src/middleware/upload.ts` |
| Testing | Vitest + Supertest | `server/tests/`, `tests/` |

### Architecture map (confirmed present and wired end to end)

Frontend entry (`src/main.tsx`, `src/app/router.tsx`) → backend entry (`server/src/server.ts`, `server/src/app.ts`) → shared Zod schemas → incident/evidence persistence (in-memory) → centralized AI provider factory → versioned prompts → structured-output validators → analysis/skeptic-review/postmortem services → API routes/controllers → React Query hooks/services → UI components.

Sample datasets (6 scenarios), evaluation fixtures (3, for the newest scenarios), `.env`/`.env.example`, `.gitignore`, and build/test scripts are all present and located as expected.

**Confirmed gap:** no `docs/` directory existed in the repository prior to this export.

---

## 3. Compliance Matrix

| ID | Requirement | Classification | Status | Evidence | Missing Work | Severity |
|---|---|---|---|---|---|---|
| M1 | Working AI-assisted prototype | MBR | PASS | `npm run build`/`npm run test` exit 0 | — | — |
| M2 | Meaningful AI use across summarization, log/evidence analysis, timeline, hypotheses, explanation, actions, bias review, skeptic review, postmortem | MBR | PASS | `server/src/ai/**`, three orchestration services | — | — |
| M3 | No unsafe AI-certainty language | MBR | PASS | `incidentAnalysisV1.ts:50,67`; `postmortemV1.ts:28-31,52-55,64`; `skepticReviewV1.ts:69` — every near-match is an instruction telling the model NOT to use such language | — | — |
| M4 | Human can explicitly confirm a hypothesis via a real, reachable code path | MBR | **FAIL** | No route/controller/UI mutation found; only `PATCH /:incidentId/statements/:statementId/review` exists, and it only updates fact/assumption review status, never `Hypothesis.status` | Add a real "confirm hypothesis" action (route + UI), or correct the README/schema-comment claim that this is supported | HIGH |
| M5 | Facts/assumptions/hypotheses/actions structurally separated | MBR | PASS | `aiAnalysisResponse.schema.ts:82-94`; `mapAnalysisResponse.ts:75-93` | — | — |
| M6 | Facts require ≥1 evidence id at the AI-input boundary | MBR | PASS | `aiAnalysisResponse.schema.ts:41-43` (`AiFactSchema.evidenceIds.min(1)`) | — | — |
| M7 | Facts require ≥1 evidence id in the persisted domain schema | MBR | PARTIAL | `shared/schemas/reasoning.schema.ts:29` — `evidenceIds` has no `.min(1)`, unlike the AI-input schema | Add `.min(1)` to the persisted schema for structural (not just incidental) guarantee | LOW |
| M8 | Unsupported AI claims flagged | MBR | PASS (minor gap) | `unsupportedClaimDetector.ts:16-23`; `mapAnalysisResponse.ts:144-146` | A fact demoted into `unsupportedClaims` is not removed from the `facts` array — it exists in both simultaneously | LOW |
| M9 | Invalid/hallucinated evidence IDs caught | MBR | PASS | `evidenceReferenceValidator.ts:16-46` (`findUnknownEvidenceReferences`), surfaced in `AnalysisRun.validationWarnings` | — | — |
| M10 | Confidence represented as uncertainty, not mathematical certainty | MBR | PASS (1 inconsistency) | `common.schema.ts:9-17`; `ConfidenceIndicator.tsx:9-24` (bar + text descriptor, never bar/number alone) | One place (`FactsAssumptionsSection.tsx:41`) shows a bare confidence number without the bar/descriptor pairing used elsewhere | LOW |
| M11 | No unvalidated-provider-response bypass (unsafe casts, direct `JSON.parse` without schema validation) | MBR | PASS | Every `JSON.parse` call site in the AI pipeline traced to an immediate `schema.safeParse()` before use; mock output goes through the identical validation path as real-provider output | — | — |
| M12 | Paste input supported for incident description, logs, error traces, monitoring alerts, deployment notes, user/support reports, API errors, database errors | MBR | PASS | `shared/constants/evidenceFields.ts:36-79`; `server/src/services/evidenceService.ts:34-50` | — | — |
| M13 | File upload support: TXT, LOG, JSON, CSV | MBR | PASS | `shared/constants/fileUpload.ts:5-8`; `server/src/middleware/upload.ts:22-42` | — | — |
| M14 | File extension validation | MBR | PASS | `upload.ts:29` (allow-list `fileFilter`) | — | — |
| M15 | File size validation | MBR | PASS | `MAX_FILE_SIZE_BYTES` = 2 MB, enforced both client- and server-side | — | — |
| M16 | Empty-file handling | MBR | PARTIAL | Server-side: an empty `.txt`/`.log` upload silently produces zero evidence items with no error (`textParser.ts:59-82` + `splitLines.ts:18-22`). Client-side: the UI already rejects 0-byte files before upload (`fileValidation.ts:30-32`), so this gap is only reachable by bypassing the UI | Add a server-side empty-file error for `.txt`/`.log`, matching the `.json`/`.csv` behavior | MEDIUM |
| M17 | Invalid JSON file handling | MBR | PASS | `jsonParser.ts:52-61` → controlled `400 INVALID_JSON_FILE` | — | — |
| M18 | Invalid CSV file handling | MBR | PARTIAL | Empty/no-data-row CSV is caught (`csvParser.ts:75-86`, `400 EMPTY_FILE`); a malformed CSV with inconsistent column counts is tokenized permissively rather than validated | Add structural CSV validation | LOW |
| M19 | Original vs. normalized evidence content stored separately | MBR | PASS | `shared/schemas/evidence.schema.ts:25-36` — distinct `originalContent`/`normalizedContent` fields | — | — |
| M20 | User-facing validation errors for bad uploads | MBR | PASS | `FileUploadZone.tsx:148-158` (client); `NewIncidentForm.tsx:253-255` surfaces backend `ApiError.message` | — | — |
| M21 | AI incident summary is evidence-based and includes an uncertainty statement | MBR | PASS | `AnalysisRunSummarySchema`; verified in prior-session real-provider output | — | — |
| M22 | Summary displayed in UI and persisted | MBR | PASS | `OverviewSection.tsx`; persisted via `AnalysisRun` | — | — |
| M23 | Summary works with mock and with a real provider | MBR | PASS | Mock: deterministic, always produces one. Real (OpenAI): verified in the prior session via real API calls returning `provider: "openai"`, `fallbackUsed: false` — not re-executed during this audit or this export | — | — |
| M24 | Timeline event required fields (timestamp, title, description, evidence ids, timestamp-type, confidence, inferred flag) | MBR | PASS | `shared/schemas/timeline.schema.ts:12-21` | — | — |
| M25 | Visible indicator distinguishing inferred/approximate timestamps from exact ones | MBR | PASS | `TimelineSection.tsx:45,63` (colored + labeled chip) and `:66-70` (separate warning `Alert` when `isInferred`) | — | — |
| M26 | Timeline events sorted chronologically | MBR | PARTIAL | Frontend always sorts defensively before display (`sortTimelineEvents.ts`), so the UI is always correct; the *persisted* `AnalysisRun.timeline` for real-provider runs is not guaranteed sorted at rest (only the deterministic mock sorts its own output) | Sort server-side on ingest for real-provider responses too | LOW |
| M27 | Invalid/invented timestamps can be detected or flagged | MBR | PARTIAL | Only ISO-format validity is schema-checked; no semantic plausibility check (e.g., outside the incident's known window) was found | Add a plausibility check | LOW |
| M28 | At least three hypotheses can be generated | MBR | PASS | `aiAnalysisResponseSchema` `.min(3)` on hypotheses; verified 3/3 in prior-session real runs | — | — |
| M29 | Hypothesis required fields (title, explanation, confidence, confidence reason, supporting/contradicting evidence, assumptions, recommended test, expected result, status) | MBR | PASS | `shared/schemas/hypothesis.schema.ts:19-31` | — | — |
| M30 | Hypotheses ranked/presented by confidence | MBR | PASS | `sortHypothesesByConfidence.ts` | — | — |
| M31 | Contradicting evidence is not hidden (architecture) | MBR | PASS | Field exists end to end, rendered in UI, never filtered | — | — |
| M32 | Contradicting evidence populated in observed real-provider practice | MBR | **PARTIAL** | Prior-session real OpenAI runs: every hypothesis across all 3 tested scenarios returned `contradictingEvidenceIds: []`, despite the architecture fully supporting it | Prompt tuning to elicit contradicting-evidence citation | MEDIUM |
| M33 | A hypothesis cannot be marked human-confirmed solely by AI | MBR | PASS | `aiAnalysisResponse.schema.ts:56-57` (AI-facing schema literally cannot accept a non-`proposed` status); `mapAnalysisResponse.ts:71` force-sets `status: 'proposed'` regardless | — | — |
| M34 | Functioning Reasoning Risks section | MBR | PASS | `ReasoningRisksSection.tsx`; `shared/schemas/bias.schema.ts` | — | — |
| M35 | All 8 named bias/fallacy types supported in schema | MBR | PASS | `bias.schema.ts:5-14` — confirmation-bias, anchoring-bias, automation-bias, post-hoc-fallacy, availability-bias, overconfidence-bias, hindsight-bias, base-rate-neglect | — | — |
| M36 | Bias findings are incident-specific, not a static list | MBR | PASS | `server/src/ai/providers/MockAIProvider.ts:210-328` — each heuristic is conditional on the specific incident's evidence/hypotheses | — | — |
| M37 | At least three relevant biases demonstrable (mock provider) | MBR | PASS | 6 of 8 types are deterministically triggerable by mock heuristics | — | — |
| M38 | At least three relevant biases demonstrable (real provider, as tested) | MBR | **FAIL** | Prior-session real OpenAI runs: `reasoningRisks: []` (zero findings) in all 3 tested scenarios, despite the prompt requiring them | Prompt tuning; document honestly either way in the reflective report | HIGH |
| M39 | Recommended actions are specific, evidence-linked, and complete | MBR | PARTIAL | Mock output: concrete and non-generic (verified in earlier sessions). Real-provider: 2 of 3 prior-session real runs populated `recommendedActions` (3 items each); one run returned zero, despite per-hypothesis `recommendedTest` being populated in all three | Prompt tuning for consistency | MEDIUM |
| M40 | Skeptic review exists, operates independently, never overwrites the original analysis | MBR | PASS | `server/tests/skepticReviewService.test.ts:46-58` explicitly asserts the original run is unmodified; `mapSkepticReviewResponse.ts` appends rather than mutates | — | — |
| M41 | Skeptic review functional requirements (challenges leading hypothesis, identifies ignored evidence, offers alternatives, assesses confirmation/anchoring bias, states a falsification test, recommends further tests) | MBR | PASS | `shared/schemas/skepticReview.schema.ts`; `server/src/ai/prompts/skepticReviewV1.ts`; content quality verified via a real prior-session run (correctly identified the leading hypothesis, substantively challenged it, named confirmation bias explicitly, proposed 2 valid alternatives, gave a genuine falsification test) | — | — |
| M42 | Documented critical-AI experiments exist (prompt comparison, model comparison, prompt-sensitivity testing, hallucination/overconfidence records) | MBR | **FAIL** | No such file exists anywhere in the repository (`docs/` did not exist prior to this export; no experiment log found) | Produce and save these experiments/records | HIGH |
| M43 | Postmortem contains required content (summary, impact, detection, timeline, hypotheses investigated, likely cause, uncertainty, resolution, corrective actions, lessons learned, follow-up items) | MBR | PASS | `shared/schemas/postmortem.schema.ts`; content verified via a real prior-session run | — | — |
| M44 | Postmortem preserves uncertainty rather than overstating certainty | MBR | PASS | Verified real-run output: "No specific confirmation of the root cause has been identified... significant correlation with the adjustments made" | — | — |
| M45 | Postmortem Markdown export works | MBR | PASS | `buildPostmortemMarkdown.ts` (implemented and tested) | — | — |
| M46 | Single centralized provider factory; feature services never instantiate a provider directly | MBR | PASS | `server/src/ai/providers/createAIProvider.ts:36-65` is the only production construction site; zero imports of concrete provider classes in `analysisService.ts`, `skepticReviewService.ts`, `postmortemService.ts` | — | — |
| M47 | Actual provider recorded via metadata (`configuredProvider`, `providerUsed`/`name`, `model`, `promptVersion`, `fallbackUsed`, `fallbackReason`, `durationMs`) | MBR | PASS | Present on every persisted `AnalysisRun`/`SkepticReview`/`Postmortem` | — | — |
| M48 | Mock fallback is never presented as a real Anthropic/OpenAI result | MBR | PASS | `fallbackUsed`/`configuredProvider` fields always distinguish a fallback result from a genuine real-provider result | — | — |
| M49 | Missing or invalid API keys do not cause silent mock fallback unless explicitly enabled | MBR | PASS | `resolveProviderSelection.ts:35-68`, gated strictly by `ALLOW_MOCK_FALLBACK` (defaults to `false`) | — | — |
| M50 | Controlled error handling for the full provider failure taxonomy | MBR | PASS | Full mapping table in Section 7 below | — | — |
| M51 | No raw SDK error, secret, or auth header ever returned to the client | MBR | PASS | `toSafeErrorDetails()` in both real providers extracts only `status`/`message`/safe `requestID`, never `headers` | — | — |
| M52 | `.env` is gitignored and has never been committed | MBR | PASS | `.gitignore:10`; `git log --all --oneline -- .env` returns empty | — | — |
| M53 | Sensitive evidence content is redacted before being sent to an external AI provider | MBR | **FAIL** | No redaction/masking/sanitization code exists anywhere in the repository; confirmed by exhaustive search. Self-disclosed honestly in `README.md:799-801` and in a UI warning banner | Implement basic redaction, or keep as an explicitly documented known limitation | HIGH (for report honesty; not a functional blocker since it is disclosed) |
| M54 | Ethical discussion is documented (not merely implicit in code) | MBR | **FAIL** | No standalone ethics/risk document exists anywhere in the repository | Write the ethics section of the reflective report | HIGH |
| M55 | UI covers the full investigation workflow | MBR | PASS | All 9 incident-workspace tabs render live, non-placeholder data | — | — |
| M56 | Baseline accessibility support | MBR | PASS (gaps noted) | See Section 9 | Add app-wide `:focus-visible` styling and skeleton loading states | LOW |
| M57 | `typecheck`/`lint`/`test`/`build` all pass | MBR | PASS | See Section 10 | — | — |
| S1 | Six diverse sample scenarios with rich, ambiguous evidence | SSR | PASS | See Section 5 | — | — |
| S2 | Evaluation fixtures for scenario grading | SSR | PASS | `server/tests/fixtures/scenarioEvaluations/` (3 scenarios) | — | — |
| S3 | Guided investigation lifecycle: status selector, progress banner, outdated-analysis indicator, add-evidence-to-existing-incident | SSR | PASS | `InvestigationProgressBanner.tsx`, `OutdatedAnalysisBanner.tsx`, `AddEvidenceDialog.tsx` | — | — |
| S4 | Multi-provider support (mock / Anthropic / OpenAI) | SSR | PASS | See Section 7 | — | — |
| A1 | PDF/print export of the postmortem | AOF | NOT APPLICABLE | Not implemented; correctly out of mandatory scope | — | — |
| A2 | MIME-type validation in addition to extension validation | AOF | PARTIAL | Extension-only validation (`fileFilter` never inspects `file.mimetype`) | Add MIME check if desired | LOW |
| D1 | Working prototype builds and runs | SD | PASS | See Section 10 | — | — |
| D2 | GitHub repository is accessible | SD | PASS | Confirmed publicly accessible, main branch visible with commit history | — | — |
| D3 | Installation and running instructions | SD | PASS | `README.md`, Installation and Running sections | — | — |
| D4 | Example input files | SD | **FAIL** | None found anywhere in the repository outside test fixtures | Add a small example evidence set | MEDIUM |
| D5 | Example output | SD | PARTIAL | Only a `/api/health` JSON example exists; no example of an actual AI analysis/hypotheses/facts output | Add one real analysis output example to the README | MEDIUM |
| D6 | Short demo video | SD | **FAIL** | Exhaustive repository search found no video link anywhere | Record and link it | HIGH (blocker) |
| D7 | Explicit list of AI tools and APIs used | SD | **FAIL** | Only exists embedded in README prose, not as a discrete list | Extract into an explicit list | LOW |
| D8 | Human-readable documentation of important prompts | SD | **FAIL** | Prompts exist only as `.ts` source files; no explanatory doc | Write a short prompts document | LOW |
| D9 | Reflective report (5–10 pages) | SD | **FAIL** | No file matching a report/reflection exists anywhere in the repository | Write it | HIGH (blocker) |
| D10 | GitHub link included inside the submitted report | SD | NOT VERIFIED | No report exists yet to check | — | — |

---

## 4. End-to-End Feature Trace

Each feature below was traced from UI through to backend and back, per the pattern: **UI → frontend service/hook → API route → controller → service → provider/repository → validated result → persisted state → displayed result.**

| Feature | UI entry point | Frontend service/hook | API route | Controller/service | Persistence | Verdict |
|---|---|---|---|---|---|---|
| Dashboard incident list | `src/pages/DashboardPage/DashboardPage.tsx` | `useIncidents()` | `GET /api/incidents` | `incidentController.ts` | `InMemoryIncidentRepository` | PASS — live data, explicit loading/error/empty states |
| Incident creation | `src/components/incidents/NewIncidentForm.tsx` | `useCreateIncident()` | `POST /api/incidents` (multipart) | `incidentController.ts` → `evidenceService.ts` / parsers | `InMemoryIncidentRepository` | PASS |
| Save & analyze | `NewIncidentForm.tsx` | `analyzeIncident()` (called directly rather than via the `useAnalyzeIncident` hook used elsewhere — a minor architectural inconsistency, not a functional defect) | `POST /api/incidents/:id/analyze` | `analysisService.ts` → AI provider factory | `AnalysisRun` appended | PASS |
| Incident workspace (9 tabs: Overview, Evidence, Timeline, Hypotheses, Facts & Assumptions, Reasoning Risks, Recommended Actions, AI Review, Postmortem) | `src/pages/IncidentWorkspacePage/IncidentWorkspacePage.tsx` | per-section hooks | various `GET`/`PATCH` routes | respective section components | `Incident` aggregate | PASS — every tab renders real, server-derived data with an explicit "no analysis yet" empty state where applicable; none fall back to static content |
| Status selector / lifecycle | `IncidentStatusSelector.tsx`, `ResolveIncidentDialog.tsx` | `useUpdateIncidentStatus` | `PATCH /api/incidents/:id/status` | `incidentStatusController.ts` | `Incident.status` | PASS |
| Guided investigation progress banner | `InvestigationProgressBanner.tsx` | derives state purely from existing incident data (`src/utils/investigationProgress.ts`) | — (client-derived) | — | — | PASS — not hardcoded |
| Add evidence to existing incident | `AddEvidenceDialog.tsx` | `useAddEvidence` | `POST /api/incidents/:id/evidence` | `incidentController.ts` | `Incident.evidence` | PASS |
| Outdated-analysis indicator | `OutdatedAnalysisBanner.tsx` | `src/utils/analysisFreshness.ts` | — (client-derived) | — | — | PASS — real timestamp comparison, not a static flag |
| Re-analysis | `WorkspaceHeader.tsx`, `OutdatedAnalysisBanner.tsx` | `useAnalyzeIncident` | `POST /api/incidents/:id/analyze` | `analysisService.ts` | new `AnalysisRun` | PASS |
| Skeptic review | `AIReviewSection.tsx` | `useRunSkepticReview` | `POST /api/incidents/:id/skeptic-review` | `skepticReviewService.ts` | `SkepticReview` appended | PASS |
| Postmortem generation/edit/export | `PostmortemSection.tsx` | `useGeneratePostmortem`, `useEditPostmortem` | `POST`/`PATCH /api/incidents/:id/postmortem` | `postmortemService.ts` | `Incident.postmortem` | PASS |

**AI pipeline trace (all three workflows):** prompt builder (`server/src/ai/prompts/*.ts`) → `AIProvider.complete()` (mock/Anthropic/OpenAI, selected once via the centralized factory) → raw text response → schema validation (`server/src/ai/validators/*.ts`) → one-shot repair retry on failure → response mapper (`mapAnalysisResponse.ts` / `mapSkepticReviewResponse.ts` / `mapPostmortemResponse.ts`) → persisted domain object → returned in the API response → rendered by the corresponding React component. This path is identical regardless of which provider is configured — confirmed by direct code trace, not assumed from naming.

---

## 5. Sample Incident Dataset Audit

All six bundled scenarios were verified programmatically against the running data files, not assumed from documentation.

| Scenario | UI-reachable | Evidence count | Distinct source types | Exact timestamps | Approx/inferred timestamps | Support/contradict/distract/missing-info signals | ≥3 hypotheses | Reasoning traps targeted | Schema-valid | Evaluation fixture | Tests |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ecommerce-checkout | Yes | 12 | 7 | 12 | 0 | Yes (by design) | via mock | deploy-vs-third-party ambiguity | Yes | No (pre-dates the fixture system) | `sampleIncidents.test.ts` |
| course-registration-slowdown | Yes | 11 | 7 | 11 | 0 | Yes | via mock | — | Yes | No | same |
| mobile-login-failure | Yes | 11 | 8 | 11 | 0 | Yes | via mock | — | Yes | No | same |
| database-connection-leak | Yes | 11 | 9 | 9 | 2 | Yes (verified) | 4 (incl. 1 decoy) | post-hoc fallacy, confirmation bias, anchoring bias, base-rate neglect | Yes | Yes, cross-verified against real evidence ids | `scenarioEvaluations.test.ts` |
| payment-gateway-timeout | Yes | 11 | 8 | 9 | 2 | Yes (verified) | 4 (incl. 1 decoy) | automation bias, availability bias, anchoring bias, overconfidence bias | Yes | Yes, cross-verified | same |
| async-queue-backlog | Yes | 11 | 7 | 9 | 2 | Yes (verified) | 4 (incl. 1 decoy) | confirmation bias, anchoring bias, post-hoc fallacy, hindsight bias | Yes | Yes, cross-verified | same |

**Integrity checks performed:** no duplicate evidence IDs within any incident; every `evidence.incidentId` matches its parent incident; every non-null timestamp is `Date.parse`-able; no scenario ID conflicts; all 6 scenarios are reachable via `GET /api/incidents/samples` with no hardcoded count anywhere in the controller or frontend "Load sample incident" menu.

**Note:** the three original scenarios have no `.eval.ts` evaluation fixture — fixture coverage currently applies only to the three newest scenarios. This is a Strong-Scope item (S1/S2), not a mandatory gap, but is worth extending for consistency in the reflective report.

---

## 6. AI Critical-Use Matrix

| Critical-use item | Code mechanism exists? | Documented experiment/log exists? | Verdict |
|---|---|---|---|
| Evidence checking (are AI claims supported by input?) | Yes — `evidenceReferenceValidator.ts`, `unsupportedClaimDetector.ts` | Runtime detection only; no written record | PARTIAL |
| Skeptic review (AI argues against its own conclusion) | Yes — a full, independent second AI pass; verified working with real output in a prior session | A real example exists in prior session records but was not saved into the repository | PASS (code) / MISSING (documentation) |
| Comparing multiple prompts | No | No | MISSING |
| Comparing multiple models | Infrastructure only (mock/Anthropic/OpenAI) | No documented comparison result | MISSING — multi-provider infrastructure alone does not constitute a documented comparison |
| Prompt-sensitivity testing (small change → different answer) | No | No | MISSING |
| Recording hallucinations | Detection mechanism exists (unknown evidence-id references produce warnings) | No positive/negative example logged as a standalone record | PARTIAL |
| Recording overconfidence | Prompt design discourages it; no detection/logging mechanism exists | No | MISSING |
| Recording unsupported assumptions | Evaluation fixtures pre-register expected assumption traps per scenario | No record of actually observed instances from a real run | PARTIAL |
| Documenting where AI helped | No | No | MISSING |
| Documenting where AI misled the investigation | No | No — though prior-session testing surfaced two concrete real examples (zero bias findings, zero contradicting evidence) that could seed this section | MISSING |

---

## 7. AI Provider and Safety Audit

**Architecture:** `server/src/ai/providers/createAIProvider.ts` is the sole production construction site for `MockAIProvider`, `AnthropicAIProvider`, and `OpenAIProvider`. None of the three orchestration services (`analysisService.ts`, `skepticReviewService.ts`, `postmortemService.ts`) import a concrete provider class — each depends only on the `AIProvider` interface.

**Provider metadata recorded on every result:** `configuredProvider`, `name` (the provider that actually produced the result), `model`, `promptVersion`, `fallbackUsed`, `fallbackReason`, `providerVerified`, `providerRequestId` (OpenAI only).

**Fallback behavior:** governed exclusively by `ALLOW_MOCK_FALLBACK` (default `false`). A missing or invalid key never silently substitutes mock output; the real provider class is still constructed and throws a controlled `503 AI_PROVIDER_NOT_CONFIGURED` error on first use unless fallback is explicitly enabled. When fallback does occur, the result is always labeled `provider: "mock"` with `configuredProvider` and `fallbackReason` preserved — it is never presented as a real Anthropic/OpenAI result.

**Controlled error taxonomy:**

| SDK condition | HTTP status | Application error code | Provider(s) |
|---|---|---|---|
| No client / no key configured | 503 | `AI_PROVIDER_NOT_CONFIGURED` | Both |
| Authentication / permission failure | 401 | `AI_PROVIDER_AUTH_FAILED` | Both |
| Rate limit exceeded | 429 | `AI_PROVIDER_RATE_LIMITED` | Both |
| Quota/billing failure (OpenAI, distinguished from ordinary rate limiting) | 429 | `AI_PROVIDER_QUOTA_EXCEEDED` | OpenAI |
| Connection/timeout failure | 502 | `AI_PROVIDER_NETWORK_ERROR` | Both |
| Bad request / server error / generic API error | 502 | `AI_PROVIDER_ERROR` | Both |
| Empty response content | 502 | `AI_PROVIDER_ERROR` | Both |
| Incomplete response (e.g., max tokens hit) | 502 | `AI_PROVIDER_ERROR` | OpenAI |
| Model refusal | 502 | `AI_PROVIDER_REFUSED` | OpenAI |

**Secret safety:** error builders on both real providers extract only `status`, `message`, and a safe request ID — never response headers (where an Authorization header could appear). The health endpoint (`GET /api/health`) reports `configuredProvider`, `apiKeyConfigured` (boolean only), `configuredModel`, `mockFallbackEnabled`, `providerVerified` — never the key or any fragment of it.

**Real-provider verification status:** real, successful OpenAI API calls were made in a prior session on this same, unchanged codebase, returning `providerUsed: "openai"` and `fallbackUsed: false` for incident analysis, skeptic review, and postmortem generation. **This was not re-executed during the audit or during this export** — the underlying code paths are unchanged (confirmed by a clean working tree and a fully passing test suite), so re-running paid API calls was not necessary or repeated.

**Provider tests:** both `AnthropicAIProvider` and `OpenAIProvider` have dedicated test suites that mock their respective SDK client — no real network calls occur during the automated test suite.

---

## 8. Privacy, Security, and Ethics Audit

**Secret hygiene — PASS.** `.env` is listed in `.gitignore` and has never been committed to Git history (`git log --all --oneline -- .env` returns empty). The tracked file set contains only `.env.example`, never a real `.env`. No API key, authorization header, or partial key is ever returned in any API response, error object, or log path — confirmed by tracing every error-detail builder in both real AI providers.

**Redaction — FAIL, honestly self-disclosed.** No redaction, masking, or sanitization code exists anywhere in the repository. Evidence content — including anything a user pastes or uploads — is sent to a configured real AI provider verbatim, with no filtering of emails, tokens, passwords, session identifiers, or payment-like values. This gap is explicitly and honestly documented in the project's own known-limitations section and in a user-facing warning banner shown on the incident-creation form, but the underlying capability does not exist.

**Ethical discussion — FAIL as a documented deliverable.** The application's ethical design choices are real and generally sound in code (hedged AI language throughout every prompt, an intended human-confirmation gate for hypotheses, evidence-reference validation to catch fabricated citations). However, no standalone document exists anywhere in the repository discussing: risks of over-trusting AI, whether AI should claim a definitive root cause, how uncertainty is shown, what information should not be sent externally, protection of private logs/user data, responsibility for harmful recommendations, or how the system supports rather than replaces human judgment. These considerations currently live only implicitly in code and comments and must still be written up for the reflective report.

**Upload safety.** Files are stored in memory only (never written to disk), which removes filesystem path-traversal risk from an unsafe filename; no explicit filename sanitization exists but poses no practical risk given the storage model.

---

## 9. UI, UX, and Accessibility Audit

**Workflow coverage:** every claimed workspace tab (Overview, Evidence, Timeline, Hypotheses, Facts & Assumptions, Reasoning Risks, Recommended Actions, AI Review, Postmortem), the Dashboard, incident creation, the status selector/lifecycle, the guided investigation progress banner, evidence addition, and the outdated-analysis indicator all render genuine, server-derived data with explicit loading/error/empty states — no hardcoded placeholders were found in any render path.

**Accessibility — positive findings:**
- Semantic landmarks (`<main>`, `<nav aria-label="Primary">`, a second `aria-label="Investigation progress"` nav landmark).
- `role="status"` on loading indicators; `role="tabpanel"`/`aria-labelledby` pairing on the workspace tabs; `aria-label` on the workspace `Tabs` component itself.
- `aria-label` on every icon-only button, with decorative icons separately marked `aria-hidden="true"`.
- Status, severity, and confidence are consistently conveyed by color **and** text together — never color alone.
- Dialogs use `aria-labelledby` tied to a real dialog title.
- One deliberate custom keyboard-focus style exists on the investigation progress banner's step buttons, including `aria-current="step"`.
- Well-formed heading hierarchy (page `h1` → section `h2` → card-level `h3`) with no skipped levels found anywhere.
- Consistent responsive layout via Material UI breakpoint props.

**Accessibility — gaps:**
- No `htmlFor` usage anywhere in the frontend; label association relies entirely on Material UI's built-in `TextField` label prop (functionally adequate, but no fallback pattern exists for any non-MUI-TextField input).
- No `Skeleton` components anywhere; all loading states use a single generic spinner-plus-text pattern rather than content-shaped placeholders.
- No explicit keyboard event handlers (`onKeyDown`/`onKeyUp`) anywhere in the frontend; keyboard support relies entirely on native tab order of real interactive elements.
- Only one custom `:focus-visible` style exists in the entire application; everywhere else relies solely on the Material UI theme's default focus styling.

**Code quality (adjacent finding relevant to UI maintainability):** no direct `fetch`/`axios` calls exist inside any component file; all network access flows through dedicated service/hook layers. No `any` types and no unsafe type assertions were found anywhere in the frontend, backend, or shared code. No dead code, unused routes, orphaned components, commented-out code blocks, or TODO/FIXME/placeholder comments were found anywhere in the repository. One minor inconsistency: the incident-creation form's "save & analyze" action calls the analysis service function directly rather than through the same React Query hook used everywhere else for the identical operation — not unsafe, just an inconsistency in an otherwise consistent layering pattern.

---

## 10. Test and Build Report

| Command | Exit code | Result |
|---|---|---|
| `npm run typecheck` | 0 | Passed — clean across both the frontend and backend workspaces |
| `npm run lint` | 0 | Passed with 0 warnings |
| `npm run test` | 0 | **667/667 tests passed** (143 frontend tests across 21 files; 524 backend tests across 35 files). 0 failed, 0 skipped |
| `npm run build` | 0 | Production build succeeded (client + server). One pre-existing, non-blocking warning: the main JavaScript bundle chunk exceeds 500 kB after minification — a build-tool advisory about code-splitting, not a functional defect |

All four commands were confirmed against the project's own `package.json` scripts before being run; no invented or substitute commands were used, and no test was modified, skipped, or deleted to obtain these results.

Circular-dependency detection was **not run** — no suitable tool was available in the audit environment. This is marked NOT VERIFIED rather than assumed to pass.

---

## 11. Documentation Audit

`README.md` (818 lines) was read in full.

| Section | Present? | Notes |
|---|---|---|
| Project purpose | Yes | Substantive |
| Main features (dedicated section) | No | No standalone "Features" heading; features are described in prose within Architecture subsections instead |
| Architecture | Yes | Substantive, detailed |
| Technology stack | Yes | Table format |
| Installation steps | Yes | Substantive |
| Environment variables table | Yes | 10 rows, matches `.env`/`.env.example` field names exactly |
| Mock provider setup instructions | Yes | |
| Anthropic provider setup instructions | Yes | |
| OpenAI provider setup instructions | Yes | |
| How to run frontend and backend | Yes | |
| How to run tests | Yes | |
| How to build | Yes | |
| Sample incidents documentation | Partial / stale | Only names 3 of the 6 bundled scenarios; the three newer scenarios (database-connection-leak, payment-gateway-timeout, async-queue-backlog) are fully implemented and tested but unmentioned |
| Example input | No | No literal example of raw incident/evidence input data exists |
| Example output | Partial | Only a `/api/health` JSON response example exists; no example of an actual AI analysis/hypotheses/facts output |
| Prompt version identifiers mentioned | Yes | `incident-analysis-v1`, `repair-invalid-json-v1`, `skeptic-review-v1`, `postmortem-v1` |
| Privacy/redaction discussion | Minimal | A single known-limitations bullet only; no dedicated privacy section |
| Known limitations section | Yes | Substantive, 9 bullets |
| Future improvements section | No | The existing "Roadmap" section is retrospective (describing completed work), not forward-looking |

No `docs/` directory, prompt-experiment log, model-comparison log, or standalone ethics/bias document existed anywhere in the repository prior to this export.

---

## 12. Official Deliverables Checklist

**Completed:**
- Working software prototype (builds and runs)
- Public, accessible GitHub repository
- Installation and running instructions
- `.env.example` with safe placeholder values
- Six sample datasets with an automated test suite

**Partially completed:**
- Example output (only a health-check JSON example exists)
- README sample-incident documentation (stale — names 3 of 6 scenarios)

**Missing:**
- Example input files
- A demo video or link to one
- A standalone "AI tools and APIs used" list
- Standalone, human-readable prompt documentation
- The reflective report itself
- A `docs/` directory (now created by this export, previously absent)

**Not verifiable from the repository alone:**
- Whether a GitHub link is included inside a submitted report (no report exists yet to check)
- Whether a demo has been recorded but not yet linked anywhere (the repository provides no evidence either way)

---

## 13. Assessment-Criteria Readiness Estimate

*These are internal readiness estimates for planning purposes only — not an official grade.*

| Area | Score (0–100) | Strengths | Risks | Highest-priority improvement |
|---|---|---|---|---|
| 1. Technical correctness & working functionality | 88 | Clean build/lint/typecheck, 667/667 tests passing, real end-to-end provider wiring, verified real OpenAI calls in a prior session | A few real edge-case gaps (empty-file upload, no hypothesis-confirm route) | Fix the empty-`.txt` upload silent-no-op gap |
| 2. Effective & critical use of AI tools | 58 | Skeptic review is a genuine, working "argue against yourself" mechanism; strong automated evidence-validation and hallucination-catching infrastructure | Real-provider output in actual prior-session tests showed zero bias findings and zero contradicting evidence across all runs tested; zero documented prompt/model comparison experiments | Run and write up deliberate prompt/model comparisons; document the real-provider shortfalls already observed |
| 3. Depth of problem-solving & incident reasoning | 85 | Six deliberately ambiguous scenarios, each with a real evaluation fixture including decoy hypotheses and contradicting/distracting/missing-information evidence | This design value is only realized if it is actually cited and discussed in the reflective report | Reference the scenario evaluation fixtures explicitly in the report |
| 4. Reflection on biases, fallacies, and AI limitations | 40 | Code-level bias taxonomy is complete; 6 of 8 types are demonstrably triggerable via the mock provider | No written reflection exists in the repository; real-provider testing exposed a genuine weakness (zero biases flagged) that has not been documented anywhere | Write the bias/fallacy section of the report using the real (not only mock) run data |
| 5. Documentation, presentation, professionalism | 55 | The README is detailed and professional for a technical audience | No reflective report, no demo video, no example input/output files, no `docs/` folder prior to this export — the actual required submission artifacts are almost entirely unwritten | Produce the reflective report and demo recording |

---

## 14. Prioritized Gap List

**Blocker before demo:** none. No code-level finding prevents a demo — the application runs and the full workflow is connected end to end.

**Blocker before submission:**
1. No reflective report exists — must be written.
2. No demo video exists — must be recorded.
3. No documented critical-AI experiments exist — needed to support the reflective report's core grading criteria.
4. No documented ethics/bias reflection exists — needed for the reflective report.

**Important quality improvement:**
5. Real-provider bias detection and contradicting-evidence population is empirically weak (per prior-session testing) — worth a prompt-tuning pass, and worth writing up honestly either way.
6. No implemented human-confirmation path for hypotheses — either build it or correct the corresponding README/schema-comment claim.
7. Update the README's sample-incident section to mention all six scenarios.
8. Add example input/output artifacts.
9. Address the empty-file and malformed-CSV backend edge cases.

**Optional enhancement:**
10. Redaction implementation — currently an honestly documented known limitation, which is an acceptable prototype-scope answer as long as it remains documented.
11. MIME-type validation, accessibility polish (app-wide focus-visible styling, skeleton loading states), CSV structural validation, and a server-side sort guarantee for real-provider timeline output.

---

## 15. Reflective Report Readiness

| Question | Answer |
|---|---|
| Is the codebase ready to support writing the reflective report? | **YES, WITH MINOR GAPS.** The architecture is sound and well-tested, and concrete raw material already exists from real prior-session OpenAI runs — including genuine shortfalls (zero bias findings, zero contradicting evidence in those runs) — that would support an honest, credible "problems and solutions" and "biases and limitations" section. What is missing is the writing, not the evidence. |
| Is the reflective report itself complete? | **NO** — it does not exist in the repository. |
| Is the project ready for demo recording? | **YES** — the working prototype, all six scenarios, and all three AI workflows are functional end to end today. |
| Is the project ready for final submission? | **NO, BLOCKERS REMAIN** — the missing demo video, missing reflective report, and missing example input/output artifacts each independently block this. |

---

## 16. Final Verdict

> **READY FOR DEMO, REPORT STILL REQUIRED**

The codebase is in strong, genuinely tested shape: a 79% strict mandatory-requirement pass rate, 100% on strong-scope enhancements, and a clean build/lint/test/typecheck run (667/667 tests passing, 0 warnings). It is not ready for final submission solely because the non-code deliverables — the reflective report, the demo video, example artifacts, and documented critical-AI experiments — do not yet exist in the repository, not because of any code defect.

---

## 17. Five Highest-Priority Next Actions

1. **Write the reflective report**, using the findings in this audit — especially the real prior-session OpenAI results showing zero bias findings and zero contradicting evidence — as genuine "problems and solutions" and "AI limitations" content. This material already exists; it needs to be written up, not regenerated.
2. **Record the demo video.** The application is functionally ready today; a walkthrough of one of the three newer scenarios end to end (analysis → skeptic review → postmortem) would exercise the full workflow.
3. **Run and log two or three small, deliberate critical-AI experiments** (for example, re-running the same incident's analysis twice and comparing hypotheses, or comparing mock vs. OpenAI output for one scenario) and save the results as a short document — this directly addresses the "no documented comparison" gap identified in this audit.
4. **Add example input/output files** to the repository (one evidence set plus one real AI-analysis JSON response) — a quick addition that closes a real submission gap.
5. **Fix the README's stale sample-incident list**, and decide whether to implement (or explicitly document as a known limitation) the missing hypothesis-confirmation code path — both are small, high-clarity improvements.
