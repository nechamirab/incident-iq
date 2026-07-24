# Prompt Comparison and Prompt Sensitivity: v1 vs. v2 vs. Sensitivity Variant

**Scenario:** `sample-db-connection-leak` (the only scenario used). **Provider:** OpenAI, `gpt-4o-mini`.
**Date:** 2026-07-24. All three legs ran through the identical repair-eligible pipeline
(schema-repair-on-invalid-JSON, then at-most-once targeted completion-repair), so they are directly
comparable. The v2 leg reuses the already-saved real verification
(`docs/experiments/real-openai-v2-verification/analysis-result.json`) rather than a duplicate call.

## Comparison table

| Criterion | v1 | v2 (existing) | Sensitivity Variant | Interpretation |
| --- | --- | --- | --- | --- |
| Supported Facts | 3, all cite valid evidence ids | 3, all cite valid evidence ids | 3, all cite valid evidence ids | Identical across all three -- fact-grounding was never the weak point. |
| Unsupported Claims | 0 | 0 | 0 | Identical. No hallucinated-evidence facts in any leg. |
| Facts vs. Assumptions separation | The causal deploy claim kept as an Assumption | Same | The causal deploy claim kept as an Assumption | Identical and correct in all three -- none promoted an unproven causal claim to Facts. |
| Hypothesis count | 3 | 3 | 3 | Identical (schema-enforced minimum). |
| Leading hypothesis (by confidence) | "Increased traffic from marketing campaign" (85) | "Increased traffic..." (75) | "Increased request volume..." (80) | **All three independently converged on the same leading explanation** -- a real point of agreement, not just coincidental wording. |
| Supporting evidence | Every hypothesis has >=1 real id | Same | Same | Identical -- never the weak point in any version. |
| Contradicting evidence (raw, pre-repair) | 0/3 hypotheses | 0/3 hypotheses | 0/3 hypotheses | **All three raw responses reproduced the same regression** -- the weakness is not specific to v1 or to the standard v2 prompt; it appears to be a general tendency of this model's first-pass response regardless of prompt wording. |
| Contradicting evidence (final, post-repair) | 2/3 hypotheses (real, valid ids) | 2/3 hypotheses (real, valid ids) | 2/3 hypotheses (real, valid ids) | **Identical 2-of-3 pattern recurred in all three independent real runs.** The repair pass consistently improves this from 0/3 to 2/3, but consistently leaves exactly one hypothesis uncontested across this small sample -- worth flagging as a possible systematic tendency, not just random variance, though n=3 is too small to be certain. |
| Reasoning Risks (raw, pre-repair) | 1 (`post-hoc-fallacy`) | 0 | 2 (`post-hoc-fallacy`, `confirmation-bias`) | **Not consistent.** v2's raw response reproduced the documented empty-reasoning-risks regression; v1's and the sensitivity variant's raw responses did not. This is a genuine, useful finding: the empty-reasoning-risks weakness is not deterministic even for the *same* underlying issue -- it varies by call, which is exactly the kind of LLM non-determinism this project's methodology exists to surface honestly rather than paper over with a single sample. |
| Reasoning Risks (final) | 1 | 1 (added by repair) | 2 (unchanged by repair -- already present) | v2 needed repair to reach 1 finding; v1 and the sensitivity variant already had relevant findings before repair ran. |
| Recommended Actions | 3, concrete, hypothesis-linked | 3, concrete, hypothesis-linked | 3, concrete, hypothesis-linked | Identical across all three -- consistently strong in every version tested. |
| Open Questions | 2 | 3 | 3 | All non-empty and genuine (no version returned zero). |
| Confidence / certainty language | Hedged ("may have", "could") throughout | Hedged throughout | Hedged throughout | No overconfident phrases in any leg -- the "never claim a definitive root cause" instruction held in all three real runs. |
| Unknown evidence references | 0 | 0 | 0 | Identical -- `validationWarnings: []` in all three; manually cross-checked, zero invented ids anywhere in any leg. |
| Quality-gate warnings (final) | 0 | 0 | 0 | Identical -- the gate found nothing left to flag in any final result. |
| Completion repair ran? | Yes -- `hypotheses` only | Yes -- `reasoningRisks` and `hypotheses` | Yes -- `hypotheses` only | Ran in all three (each raw response had the all-hypotheses-missing-contradicting-evidence deficiency); only v2 also needed the reasoning-risks repair, since only v2's raw response had zero. |
| Skeptic/counter-hypothesis quality | Not run for this leg (analysis only) | PASS (see `real-openai-v2-verification/evaluation.md`) | Not run for this leg (analysis only) | Only the existing v2 leg includes a skeptic review; this experiment's scope was analysis-only for the new v1/sensitivity calls, per its own instructions. |

## Interpretation: does v2 measurably outperform v1?

**Not on this single-scenario, single-call-per-version sample.** The saved data does not support
claiming v2 is unambiguously better than v1:

- On **contradicting evidence**, all three versions performed identically (0/3 raw, 2/3 after repair).
  v2's stronger, more explicit instructions did not produce a different *final* result here than v1's
  simpler instructions did, once the completion-repair pass is included for both.
- On **reasoning risks**, v2 was actually the *weakest* of the three in its raw response (0 vs. 1 vs.
  2) -- the opposite of what the `v2` prompt was designed to improve. This does not mean `v2` is worse
  than `v1` in general; it means that in this one real call, `v1` and the sensitivity variant happened
  to produce non-empty reasoning risks and `v2` did not. This is the kind of result that would need
  many repeated real calls per version to resolve into a reliable signal -- exactly the "not
  statistically representative" limitation this project states honestly rather than resolves by
  cherry-picking.
- On every other criterion (facts, assumptions, supporting evidence, recommended actions, unknown
  references, quality-gate warnings, certainty language), the three versions were **indistinguishable**
  in this sample.

## Interpretation: does the small prompt-sensitivity variation change the answer?

**Partially.** The "argue against the first apparent cause" instruction did not change the *leading*
hypothesis (still the traffic-increase explanation) or the final contradicting-evidence pattern
(still 2/3), but it did produce a materially different **raw** response: 2 reasoning risks instead of
0, and hypothesis confidence-reason text that explicitly discusses competing evidence in more detail
(e.g., "reports indicate that retries were sometimes successful, suggesting other underlying issues
could be present" -- language not present in the standard v2 run). This is a real, observed effect of
the wording change on the model's *raw* output, even though it did not change the model's ultimate
leading conclusion in this sample.

## Honesty notes

- This is **one real call per version** on **one scenario**. It is not a statistically representative
  sample, and a repeat run could plausibly produce different numbers for the varying criteria
  (reasoning risks, which hypothesis stays uncontested) given LLM non-determinism -- this is stated
  explicitly, not glossed over.
- No output was manually edited. Every number above comes directly from the saved JSON files (which
  include both the raw pre-repair response and the final post-repair result for independent
  verification).
- No unknown/invented evidence ids appeared in any of the three real analysis calls made across this
  project's real-provider verification work to date.
- This experiment does not by itself resolve M32 (contradicting evidence) or M38 (reasoning risks) in
  `docs/requirements-compliance-closure.md` to `RESOLVED` -- see that document for the current,
  honest status.
