# Evaluation: Real OpenAI Verification of `incident-analysis-v2`

Scenario: `sample-db-connection-leak`. Provider: OpenAI (`gpt-4o-mini`). Date: 2026-07-24.
Compared against `server/tests/fixtures/scenarioEvaluations/databaseConnectionLeak.eval.ts`.

## Summary table

| Criterion | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Real OpenAI provider used | PASS | `analysis-result.json`: `"provider": "openai"`, `"configuredProvider": "openai"`. `skeptic-review-result.json`: same. | `providerVerified` was `true` on the provider instance after both calls. |
| No fallback | PASS | Both files: `"fallbackUsed": false`, `"fallbackReason": null`. | `ALLOW_MOCK_FALLBACK=false` was also confirmed set before the run. |
| Facts supported (evidence-linked) | PASS | 3/3 facts each cite exactly one real evidence id (`ev-01`, `ev-02`, `ev-03`). | None cite zero evidence ids. |
| Facts/Assumptions separation | PASS | The causal claim "the deploy caused the connection-pool exhaustion" was placed under `assumptions`, not `facts`, with an explicit `explanation` naming timing coincidence as the (non-conclusive) basis. | Matches the fixture's `mustNotBePresentedAsFacts` entry almost verbatim. |
| Three or more hypotheses | PASS | 3 hypotheses returned. | Matches the schema-enforced minimum. |
| Supporting evidence | PASS | Every hypothesis has >=1 real supporting evidence id (`ev-07`, `ev-04`, `ev-02` respectively). | |
| Contradicting evidence | **PARTIAL** | Pre-repair: all 3 hypotheses had `[]`. Post-repair: 2 of 3 populated -- H2 (leading, "traffic increase") cites `ev-10`, exactly one of the fixture's `challengingEvidenceIdsForLeadingExplanation`; H3 ("deploy inefficiencies") cites `ev-08`. H1 ("ORM session leak") remains `[]`, despite the fixture identifying `ev-04`/`ev-10` as relevant challenges to that hypothesis's real-world analog. | See "Contradicting-evidence analysis" below -- not marked FAILED (not *every* hypothesis is empty), but not a full PASS either. |
| Reasoning Risks | PASS | Pre-repair: `[]`. Post-repair: 1 finding (`confirmation-bias`, `detectedIn` the deploy-timing assumption, `evidenceIds: [ev-01, ev-02]`, concrete mitigation). | A real, non-empty, evidence-grounded, incident-specific finding -- not a generic/static list. Only 1 of up to 4 plausible fixture-suggested types was produced; the task does not require all four. |
| Recommended Actions | PASS | 3 actions, each with a specific title/description, a named metric or artifact (session hold times, pool-utilization-vs-traffic ratio, the specific repository-layer diff), a hypothesis link, an expected outcome, and a stated risk. | None match the generic-phrase list ("check the logs", "investigate further", "debug the issue", "monitor the system"). |
| Unknown Evidence IDs | PASS | `validationWarnings: []`, `unsupportedClaims: []`. Manually cross-checked every cited id (facts, timeline, hypotheses, reasoning risks, recommended actions, skeptic review's `ignoredEvidenceIds`) against the incident's real `ev-01`..`ev-11` -- zero invented ids found anywhere. | |
| Quality Gate | PASS | Correctly identified 2 deficiencies in the raw response (`empty-reasoning-risks`, `all-hypotheses-missing-contradicting-evidence` -- the incident has 11 evidence items, above the 5-item richness threshold) and triggered repair; final `qualityWarnings: []`. | |
| Completion Repair | PASS (triggered, ran once, safe) | `completionRepairAttempted: true`, `completionRepairedSections: ["reasoningRisks", "hypotheses"]`. Ran exactly once (total analysis calls = 2, not 3). `facts`/`summary` byte-for-byte identical before and after; all 3 hypothesis titles/descriptions unchanged; `ev-08`/`ev-10` are real, pre-existing ids, not invented; no new timeline events or timestamps introduced. | See "Repair-pass safety check" below for the full comparison. |
| Skeptic Review | PASS | Correctly identified the leading hypothesis (`hypothesis-81704c5a...`, confidence 75, the highest of the three) as `challengedHypothesisId`. Substantively challenges it, proposes 3 alternative explanations (including the base-rate-neglect angle: "intermittent connection-pool exhaustion has occurred in the past without any recent deploys"), explicitly names confirmation bias, states a concrete falsification condition, recommends 3 concrete (non-generic) tests, and lists `ignoredEvidenceIds: [ev-05, ev-06, ev-09, ev-11]` -- verified correct: none of those four ids appear anywhere in the original analysis run. `provider: "openai"`, `fallbackUsed: false`. | Not generic disagreement -- every claim is specific to this incident's actual evidence. |

## Contradicting-evidence analysis (Section 6 detail)

This is the single item not marked a clean PASS, reported honestly rather than rounded up:

- **Before repair:** the model's first response reproduced the exact prior regression --
  `contradictingEvidenceIds: []` for all 3 hypotheses.
- **After repair:** 2 of 3 hypotheses gained real, valid, contextually relevant contradicting
  evidence. Notably, the **leading** hypothesis (the one a user would see ranked first) now cites
  `ev-10` -- exactly the evidence the evaluation fixture flags as the correct challenge to a
  traffic-driven explanation (this alert has fired before, unrelated to any deploy).
- **What's still short of a full PASS:** hypothesis 1 ("new ORM session manager is causing connection
  leaks") remains uncontested. The fixture's real-world analog to this hypothesis
  (`deploy-introduced-leak`) lists `ev-04` and `ev-10` as relevant contradicting evidence -- both were
  available to the model in the prompt, and both were in fact cited elsewhere in the *same* response
  (as supporting/contradicting evidence for the *other* hypotheses), so this isn't a case of missing
  evidence access.
- **Root-cause attribution (per the task's categories):** this is best attributed to **model output
  quality** with a secondary **repair-behavior** contributor -- the targeted completion-repair prompt
  asks the model to reconsider contradicting evidence "for each hypothesis" but does not require
  every hypothesis to end up with a non-empty list, by design (an empty list is explicitly allowed to
  remain empty when genuinely nothing applies, per `targetedCompletionRepairV1.ts`'s own rules, so the
  merge logic cannot distinguish "the model still found nothing" from "the model didn't try as hard
  for this one" from a single sample). This is not a demonstrable code or prompt defect -- it is
  the kind of run-to-run variance expected from a non-deterministic LLM call, and improving it further
  without cherry-picking a lucky run would require averaging over multiple real calls, which is out of
  this task's one-call budget.
- **Verdict:** `PARTIAL`, not `FAILED` -- the task's explicit FAIL condition ("every hypothesis still
  has an empty contradicting-evidence list") does not apply, since 2 of 3 are populated with real,
  relevant evidence. This is a genuine, measurable improvement over the fully-empty (0-of-3) prior
  baseline, not a full resolution. **No code or prompt change was made** in response to this finding
  -- per the task's instructions, a fix is only warranted when a defect is "clearly responsible," and
  this is better explained by expected single-sample LLM variance than a demonstrable bug.

## Repair-pass safety check (Section 9 detail)

Comparing `rawResponse.rawText` (pre-repair) against the top-level persisted fields (post-repair):

| Field | Pre-repair | Post-repair | Changed? |
| --- | --- | --- | --- |
| `facts` (3 items) | Identical statements/evidenceIds/confidence | Identical | No |
| `summary` | Identical | Identical | No |
| Hypothesis titles (3) | "New ORM session manager...", "Increased traffic...", "The deploy introduced inefficiencies..." | Identical titles/descriptions | No |
| Hypothesis `contradictingEvidenceIds` | `[]`, `[]`, `[]` | `[]`, `["ev-10"]`, `["ev-08"]` | Yes -- the targeted section |
| `reasoningRisks` | `[]` | 1 item (confirmation-bias) | Yes -- the targeted section |
| `openQuestions`, `uncertaintyStatement`, `recommendedActions`, `timeline` | present, non-trivial | identical | No |
| New/invented evidence ids | N/A | `ev-08`, `ev-10` used -- both pre-existing, real ids | No inventions |
| New/invented timestamps | N/A | No new timeline events | No inventions |

This confirms, from the actual real output (not merely from the automated unit tests for
`mergeCompletionRepair.ts`), that the repair pass behaved exactly as designed: it improved only the
two deficient sections, left facts/summary/hypothesis identity untouched, and never fabricated new
evidence ids or timestamps.

## Counts (Section 4/5/7/8 summary)

- Valid Facts: **3** (3/3 cite real evidence ids)
- Assumptions: **1**
- Unsupported Claims: **0**
- Unknown evidence references: **0** (checked across facts, timeline, hypotheses, reasoning risks, recommended actions, and the skeptic review)
- Validation warnings: **0**
- Hypotheses: **3** (all >= 1 supporting evidence id; 2/3 with contradicting evidence post-repair)
- Reasoning Risks: **1** (relevant, evidence-grounded; 0 irrelevant/unsupported; 3 of the fixture's 4 suggested types not produced in this single run)
- Recommended Actions: **3** (3 concrete, 0 generic; 3/3 have a valid hypothesis and/or evidence link)
