# Reflective-Report Completion: Prompt Comparison and Prompt Sensitivity

This directory saves the results of two real, one-time OpenAI experiments performed specifically to
complete the reflective report's prompt-comparison and prompt-sensitivity requirements, which
`docs/experiments/prompt-comparison/` and `docs/experiments/prompt-sensitivity/` (the `ai:experiment`
CLI framework's own mock-only results) had left honestly recorded as `"not-run"`.

## What was run

| | |
| --- | --- |
| Date | 2026-07-24 |
| Scenario | `sample-db-connection-leak` (the only scenario used) |
| Provider | OpenAI |
| Model | `gpt-4o-mini` (same as the existing `real-openai-v2-verification/` run) |
| Fallback | No (`fallbackUsed: false` on both new results) |
| New real OpenAI calls made | 4 (2 for the v1 leg: initial + completion-repair; 2 for the sensitivity leg: initial + completion-repair) |

Both new legs ran through a pipeline that exactly mirrors `analysisService.ts`'s production logic
(schema-repair-on-invalid-JSON, then at-most-once targeted completion-repair), generalized to accept
a non-default prompt builder, so they are directly comparable to the already-saved v2 result, which
went through the identical real pipeline.

## Files

- `prompt-v1-result.json` -- real `AnalysisRun` produced by `incident-analysis-v1`.
- `prompt-v2-result.json` -- a small reference file pointing to the existing
  `docs/experiments/real-openai-v2-verification/analysis-result.json`, reused as the v2 leg rather
  than making a duplicate real call, per this experiment's own instructions.
- `prompt-sensitivity-result.json` -- real `AnalysisRun` produced by the "argue against the first
  apparent cause" `incident-analysis-v2` variant (`server/src/experiments/promptSensitivityVariant.ts`,
  already part of the codebase, reused here rather than duplicated).
- `comparison.md` -- the full criterion-by-criterion comparison table and honest interpretation.

## Headline finding

All three versions produced an **identical** contradicting-evidence pattern after repair (2 of 3
hypotheses populated, 1 left empty) and an identical leading hypothesis (the traffic-increase
explanation). They **differed** on raw (pre-repair) reasoning risks: v1 and the sensitivity variant
both had 1-2 findings before any repair; v2's raw response had zero, reproducing the documented
regression. See `comparison.md` for the full breakdown and the honest conclusion that this
single-sample data does **not** support a claim that v2 is unambiguously better than v1.

## Honesty notes

- No output was manually edited after being saved.
- No API key, authorization header, cookie, `.env` value, private log, or raw SDK request object is
  present in any file here.
- This is one real call per version on one scenario -- not a statistically representative sample,
  stated explicitly in `comparison.md` rather than glossed over.
