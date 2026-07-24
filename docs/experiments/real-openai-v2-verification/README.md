# Real OpenAI Verification of `incident-analysis-v2`

This directory records a **real, billable OpenAI verification run** performed to check whether the
changes made in this compliance-closure effort (`incident-analysis-v2`, the provider-independent
quality gate, the targeted completion-repair pass, and evidence-reference validation) actually
improve real-provider output, rather than only passing mocked automated tests.

## What was run

| | |
| --- | --- |
| Date | 2026-07-24 |
| Scenario | `sample-db-connection-leak` (bundled synthetic incident; no real/production data) |
| Provider | OpenAI, via `AnthropicAIProvider`'s sibling `OpenAIProvider` (real API key, `AI_PROVIDER=openai`, `ALLOW_MOCK_FALLBACK=false`) |
| Model | `gpt-4o-mini` (as configured locally in `OPENAI_MODEL`) |
| Prompt version (analysis) | `incident-analysis-v2` |
| Prompt version (review) | `skeptic-review-v1` |
| Real OpenAI requests made | **2** (1 initial analysis + 1 targeted completion-repair) + **1** (skeptic review) = **3 total** |
| Fallback used | No (`fallbackUsed: false` on both saved results) |
| `providerVerified` after the run | `true` |

This was run through the **real production code path** -- `analysisService.analyzeIncident` and
`skepticReviewService.runSkepticReview` -- against an `InMemoryIncidentRepository` seeded with only
the one bundled sample incident, so the quality gate and completion-repair pass exercised here are
exactly the same code a real user's "Analyze" / "Run skeptic review" button would trigger, not a
simplified or mocked path.

## Files

- `analysis-result.json` -- the real, persisted `AnalysisRun` this run produced. Schema-validated
  against `shared/schemas/analysisRun.schema.ts` (confirmed separately, not merely assumed).
- `skeptic-review-result.json` -- the real, persisted `SkepticReview` this run produced.
  Schema-validated against `shared/schemas/skepticReview.schema.ts`.
- `evaluation.md` -- the full criterion-by-criterion evaluation, with a PASS/PARTIAL/FAIL table.

## Honesty notes

- Neither JSON file was hand-edited after being written by the verification script. What's saved is
  exactly what the real pipeline produced and persisted.
- `analysis-result.json`'s `rawResponse.rawText` field is the model's **first** (pre-repair) response
  -- it shows `"reasoningRisks": []` and every hypothesis with `"contradictingEvidenceIds": []`,
  reproducing the exact prior-session regression (`docs/requirements-compliance-audit.md` M32/M38)
  in this fresh real call. The top-level `reasoningRisks`/`hypotheses` fields reflect the **final**,
  post-completion-repair result -- both are preserved in the same file specifically so this
  before/after comparison is auditable rather than asserted.
- No API key, authorization header, or raw SDK request/response object is present in any file here
  -- only the sanitized, persisted domain objects, which never carry that information in the first
  place (see `docs/architecture.md`, Section 9).
- See `evaluation.md` for the full pass/partial/fail breakdown, including one item (contradicting
  evidence) marked `PARTIAL` rather than `PASS` -- reported honestly, not upgraded.
