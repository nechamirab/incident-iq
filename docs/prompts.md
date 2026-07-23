# AI Prompts

This document lists every prompt IncidentIQ sends to an AI provider. There is **no** separate
"bias review" prompt -- reasoning-risk (bias/fallacy) detection is one section of the main
incident-analysis prompt's required response, not a standalone AI call. Source of truth for all of
these is `server/src/ai/prompts/`; this document summarizes each one, it does not replace reading
the code.

Every prompt below applies identically regardless of which provider (`mock`, `anthropic`, `openai`)
receives it -- `MockAIProvider` derives its response from the incident's evidence and ignores the
prompt text by design (see `docs/experiments/README.md`); real providers receive the prompt exactly
as built, after redaction (see `docs/architecture.md`, Section 5).

## `incident-analysis-v1`

- **File:** `server/src/ai/prompts/incidentAnalysisV1.ts`
- **Purpose:** The original primary incident-analysis prompt. Given an incident and its full
  evidence list, asks the model for a structured, evidence-grounded analysis in one JSON object:
  summary, timeline, facts, assumptions, at least three hypotheses, reasoning risks, recommended
  actions, open questions, an uncertainty statement.
- **Inputs:** The incident's title, severity, affected service, start/detection time, description,
  and every evidence item (labeled with its exact id).
- **Expected output:** JSON matching `AiAnalysisResponseSchema` (`server/src/ai/schemas/aiAnalysisResponse.schema.ts`).
- **Safety rules:** use only supplied evidence and evidence ids (never invent components,
  timestamps, or ids); never treat deployment timing alone as proof of causation; separate facts
  (evidence-cited) from assumptions; propose at least three falsifiable hypotheses with
  supporting/contradicting evidence; avoid certainty language ("definitely", "proves", "the root
  cause is"); flag statements needing human verification.
- **Limitations:** does not explicitly instruct the model to *actively search* for contradicting
  evidence (it only asks for it if found), which real-provider testing found led to hypotheses with
  empty `contradictingEvidenceIds` and no explanation -- see `docs/requirements-compliance-audit.md`
  for the documented finding this motivated. `v1` is preserved unchanged, specifically so
  Experiment A (`docs/experiments/prompt-comparison/`) can compare it against `v2` on identical
  evidence; it is not used by `analysisService` in normal operation.

## `incident-analysis-v2`

- **File:** `server/src/ai/prompts/incidentAnalysisV2.ts`
- **Purpose:** The current production incident-analysis prompt (`analysisService.ts` uses this, not
  `v1`). Same required JSON shape and schema as `v1`; adds explicit instructions targeting the
  specific weaknesses `v1`'s real-provider testing surfaced.
- **Inputs:** identical to `v1`.
- **Expected output:** identical schema to `v1` (`AiAnalysisResponseSchema`).
- **Changes from `v1`:**
  1. Numbered, more explicit rule list (14 numbered rules vs. `v1`'s prose bullets).
  2. Rule 4: for **each** hypothesis, actively search for contradicting evidence as a deliberate,
     separate step -- not only report it if stumbled upon.
  3. Rule 6: when no contradicting evidence is found after actively looking, say so explicitly in
     `confidenceReason` rather than leaving an unexplained empty array.
  4. Rule 7: reasoning risks must be grounded in what actually appears in *this* incident's evidence
     (via `detectedIn`/`evidenceIds`) -- explicitly correct to return zero if none genuinely apply,
     never fabricated to fill the array, and never a static, forced list of all eight bias types.
  5. Rule 8: every recommended action must reference a concrete evidence id, hypothesis id, or open
     question, and name a specific metric/component/comparison/time range -- generic advice
     ("check the logs", "investigate further") is explicitly prohibited.
  6. Rule 12: explicitly prohibits presenting correlation as proven causation, not just deployment
     timing specifically (a slightly broader restatement of `v1`'s rule).
  7. A concise few-shot example (`FEW_SHOT_EXAMPLE`) using a synthetic, unrelated incident (an
     email-delivery delay, deliberately not any bundled sample) to illustrate the expected *depth* of
     a `confidenceReason` that explains an actively-sought-but-absent contradiction -- the model is
     explicitly told this example's content, wording, bias types, and hypotheses must never be
     copied into its own response.
- **Safety rules:** identical to `v1`, restated with the numbering above; still forbids inventing
  evidence ids/timestamps, still requires hedged uncertainty language.
- **Limitations:** does not change the underlying schema, and cannot force a genuinely bias-free or
  contradiction-free incident to have either -- see `docs/bias-and-fallacy-analysis.md` and
  `docs/experiments/prompt-comparison/` for what actual comparison data exists.

## `repair-invalid-json-v1`

- **File:** `server/src/ai/prompts/repairInvalidJsonV1.ts`
- **Purpose:** A one-shot correction prompt used only when a provider's response to an analysis,
  skeptic-review, or postmortem prompt either was not valid JSON, or was valid JSON that failed
  schema validation. Shared by every AI workflow via `runProviderWithRetry.ts`.
- **Inputs:** the original prompt, the model's invalid previous response (truncated to 4000
  characters), and a human-readable description of what was wrong (a JSON parse error message, or
  the concatenated list of Zod validation issues).
- **Expected output:** the same JSON shape the original prompt required.
- **Safety rules:** reuses the original prompt's system message verbatim (the rules and target shape
  never change for a repair); explicitly instructs no markdown code fences and no commentary.
- **Limitations:** attempted **exactly once** per request. If the corrected response is still
  invalid, the run fails with a controlled `AI_RESPONSE_INVALID` error rather than retrying
  indefinitely -- malformed data is never persisted or returned to the user.

## `targeted-completion-repair-v1`

- **File:** `server/src/ai/prompts/targetedCompletionRepairV1.ts`
- **Purpose:** Repairs a response that is already schema-valid but was found *incomplete* by the
  provider-independent quality gate (`analysisQualityEvaluator.ts`) -- distinct from
  `repair-invalid-json-v1`, which repairs a response that failed schema validation. Used only by
  `analysisService.ts`, for analysis responses specifically.
- **Inputs:** the original prompt, the previous (schema-valid) response text, which specific
  deficiencies were found (`empty-reasoning-risks`, `empty-recommended-actions`,
  `all-hypotheses-missing-contradicting-evidence`, `empty-open-questions`,
  `trivial-uncertainty-statement`), and the incident's real evidence ids restated for grounding.
- **Expected output:** the same full JSON shape as the original analysis response.
- **Safety rules:** explicitly instructed to improve *only* the named deficient section(s) and copy
  every other field -- including `facts` and `summary` -- unchanged, except to correct or remove a
  fact's citation if it references an evidence id outside the restated known-id list; explicitly
  told it is correct to return a section still empty if nothing genuinely applies after real
  reconsideration, rather than inventing content to fill it; explicitly forbidden from inventing new
  evidence ids.
- **Limitations:** attempted **at most once** per analysis run, and only for the specific deficiency
  list above (a generic-language or overconfident-phrasing quality warning is never a trigger for
  this pass, since a single targeted repair request is not well suited to fixing free-text style
  issues safely). `mergeCompletionRepair.ts` additionally enforces at the code level (not just the
  prompt) that only the named sections are ever adopted from the repaired response, and only when
  they demonstrably improved -- this is a second, independent safeguard beyond the prompt's own
  instruction.

## `skeptic-review-v1`

- **File:** `server/src/ai/prompts/skepticReviewV1.ts`
- **Purpose:** Given an incident and one of its completed analysis runs, asks the model to critically
  challenge that run's leading (highest-confidence) hypothesis -- never to simply restate or validate
  the original analysis.
- **Inputs:** the incident's evidence, and every hypothesis from the run being reviewed, each
  labeled with its real id, confidence, description, confidence reason, and supporting/contradicting
  evidence -- the leading hypothesis is explicitly marked "LEADING HYPOTHESIS TO CHALLENGE" by the
  backend, which computes this itself (highest confidence, ties broken by list order) rather than
  asking the model to determine it.
- **Expected output:** JSON matching `AiSkepticReviewResponseSchema` -- `challengeSummary`,
  `alternativeExplanations`, `confirmationBiasAssessment`, `falsificationTest`, `recommendedTests`,
  `overallAssessment`. Deliberately omits `challengedHypothesisId`/`ignoredEvidenceIds`: both are
  facts the backend can determine with certainty (the leading hypothesis by confidence comparison;
  "ignored" evidence by checking which ids the original run never cited anywhere), so asking the AI
  for either would only add a class of possible hallucination with no benefit --
  `mapSkepticReviewResponse.ts` attaches both itself.
- **Safety rules:** search for alternative explanations the original analysis under-weighted
  (including its own lower-ranked hypotheses); assess whether the leading hypothesis shows signs of
  confirmation bias; state a concrete falsification condition; recommend concrete additional tests,
  never generic advice; use only the supplied evidence; never use certainty language (this is a
  critique highlighting gaps, not a verdict).
- **Limitations:** reviews only the *latest* analysis run on an incident; there is no way to request
  a skeptic review of an older run once a newer one exists. See
  `docs/experiments/README.md` (Experiment D) for how review quality is actually measured against
  six fixed criteria.

## `postmortem-v1`

- **File:** `server/src/ai/prompts/postmortemV1.ts`
- **Purpose:** Given an incident and its latest analysis run, drafts a full postmortem document a
  human will then edit in place -- explicitly framed to the model as "produce a strong starting
  point, not a finished document."
- **Inputs:** the incident and the analysis run being summarized (facts, hypotheses, reasoning
  risks, recommended actions, open questions).
- **Expected output:** JSON matching `AiPostmortemResponseSchema` --
  `incidentSummary`/`impact`/`detection`/`timeline`/`contributingFactors`/`hypothesesInvestigated`/
  `likelyCause`/`uncertaintyStatement`/`resolution`/`correctiveActions`/`lessonsLearned`/
  `followUpItems`.
- **Safety rules:** use only the supplied incident/run, never invent details; use "likely cause"
  language unless a hypothesis is already `confirmed-by-human` (a status only an explicit human
  review action can set -- the AI can never set it, including while drafting a postmortem); list
  every hypothesis investigated, not only the leading one; never invent a resolution for an incident
  that isn't `resolved`; ground `correctiveActions`/`lessonsLearned`/`followUpItems` in the run's own
  recommended actions, reasoning risks, and open questions rather than generic advice.
- **Limitations:** always summarizes the incident's *latest* analysis run; regenerating fully
  replaces the current draft (including prior human edits, with a UI warning) rather than merging.

## No secrets in any prompt

None of the prompts above embed an API key, an authorization header, or any other secret --
provider authentication happens entirely at the HTTP-client level (`Anthropic`/`OpenAI` SDK
construction), never inside prompt text. Evidence content sent to a real provider passes through
redaction first (see `docs/architecture.md`, Section 5) before any prompt built from it leaves the
process.
