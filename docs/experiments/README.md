# Critical AI Experiments

This directory holds the output of IncidentIQ's **critical-AI experiment
framework** -- a repeatable, safe harness for comparing AI behavior across
prompt versions, providers, and prompt variants, built to satisfy the
project brief's requirement for at least one critical, evidence-based
experiment involving the AI features rather than only "the app has an AI
provider abstraction."

Run it with:

```bash
npm run ai:experiment                                             # mock-only, all four experiments
npm run ai:experiment -- --experiment=A                           # just Experiment A
npm run ai:experiment -- --experiment=A,C --real --provider=openai --yes
```

The framework is implemented in `server/src/experiments/` and its
entry point is `server/src/experiments/cli.ts`. It is **never** wired into
`npm test` or any CI-equivalent script -- it is only ever invoked directly
via the `ai:experiment` npm script, so it can never run automatically.

## The four experiments

| Experiment | What it compares | Safe in mock-only mode? |
| --- | --- | --- |
| **A -- Prompt comparison** | `incident-analysis-v1` vs. `incident-analysis-v2` on the same incident | No -- see below |
| **B -- Provider comparison** | Mock vs. a real provider (OpenAI, and Anthropic if configured) on the same prompt/incident | Partially -- the mock leg always runs |
| **C -- Prompt sensitivity** | The standard `incident-analysis-v2` prompt vs. a variant instructing the model to actively argue against the most obvious apparent cause | No -- see below |
| **D -- Skeptic review evaluation** | Scores a skeptic review against six fixed, mechanically-checkable criteria (see `server/src/experiments/skepticReviewCriteria.ts`) | **Yes** |

### Why A and C are not meaningful in mock-only mode

`MockAIProvider` is deliberately deterministic and derives its entire
response from the incident's evidence -- it never reads the prompt text at
all (see `MockAIProvider.complete`'s unused `_prompt` parameter). Running
prompt v1 and v2 (or the standard and "argue against" variants) through the
mock provider therefore always produces the same output regardless of which
prompt was used. Every run of Experiments A and C still executes a **mock
pipeline check** first -- proving both prompt versions produce a
schema-valid `AnalysisRun` through the exact same shared validation
pipeline production code uses -- but this is explicitly labeled as *not* a
real comparison in both the saved JSON and Markdown. The actual v1-vs-v2 (or
standard-vs-variant) comparison only exists once a real provider call has
genuinely executed; until then, `realComparison` is honestly recorded as
`"not-run"` with a specific reason, never invented or silently omitted.

### Why B and D are safe (or partially safe) without a real provider

Experiment B always runs its mock leg (useful on its own as a pipeline
sanity check) and additionally runs a real-provider leg only when the
combined safety gate (below) allows it. Experiment D reviews a
mock-generated baseline analysis with a skeptic review that is itself a
genuine, non-trivial function of the run being reviewed (see
`MockAIProvider.buildMockSkepticReview`) -- so scoring it against the six
criteria is meaningful without any real provider call, and this is the one
experiment safe to treat as "fully exercised" in the mock-only outputs
committed to this repository.

## Real-provider call safety

A real, billable call to OpenAI or Anthropic is made **only** when every one
of these is true simultaneously (`server/src/experiments/realCallGate.ts`):

1. `--real` was passed on the command line.
2. `--provider=openai` and/or `--provider=anthropic` was passed, naming the provider(s) to attempt.
3. `RUN_REAL_AI_EXPERIMENTS=true` is set in the environment.
4. An API key is actually configured for that provider (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`).
5. The call was explicitly approved: either `--yes` was passed, or (when running interactively) a `y` was typed in response to a confirmation prompt that states the exact number of real calls about to be made.

If any condition is not met, the framework never fails silently -- it prints
exactly why the real leg was skipped and records `"not-run"` (with that
reason) in the saved results, and still completes every experiment
end-to-end using the mock provider. No API key, request header, or raw
provider payload is ever written to any file in this directory or printed
to the console.

## Layout

- `prompt-comparison/latest.json` / `latest.md` -- Experiment A
- `provider-comparison/latest.json` / `latest.md` -- Experiment B
- `prompt-sensitivity/latest.json` / `latest.md` -- Experiment C
- `skeptic-review/latest.json` / `latest.md` -- Experiment D

Each run overwrites `latest.json`/`latest.md` for the experiment(s) it
covers -- this is a repeatable local framework, not an append-only log.
`latest.json` is the raw, sanitized result; `latest.md` is a
human-readable summary with a comparison table.

## Status of the results currently committed in this directory

The `prompt-comparison/`, `provider-comparison/`, `prompt-sensitivity/`, and `skeptic-review/`
results currently committed here were produced by a **mock-only** run of the CLI framework above
(`npm run ai:experiment`, no `--real` flag). Every real-provider leg in *those* four directories is
still honestly recorded as `"not-run"` -- the CLI framework itself has not been re-run with `--real`
since these files were written. Running it with `--real --provider=openai --yes` (with
`RUN_REAL_AI_EXPERIMENTS=true` and a valid `OPENAI_API_KEY` configured) would overwrite them with a
genuine real-provider comparison.

## Real OpenAI verification of `v2` (`real-openai-v2-verification/`)

Separately from the CLI framework above, a **real, one-time OpenAI verification** was performed
directly against the production analysis/skeptic-review code path (not the CLI experiment harness)
and its results are saved in `real-openai-v2-verification/` (not overwritten on each `ai:experiment`
run -- a standalone, dated record).

| | |
| --- | --- |
| Date | 2026-07-24 |
| Scenario | `sample-db-connection-leak` (the only scenario used) |
| Provider | OpenAI |
| Model | `gpt-4o-mini` |
| Prompt version | `incident-analysis-v2` (analysis), `skeptic-review-v1` (review) |
| Real calls made | 3 (1 initial analysis + 1 targeted completion-repair + 1 skeptic review) |
| Fallback used | No (`fallbackUsed: false` throughout) |
| Facts / Assumptions separation | PASS |
| Contradicting evidence | **PARTIAL** -- 2 of 3 hypotheses gained real, relevant contradicting evidence after repair; 1 remained empty |
| Reasoning Risks | PASS, with limited coverage -- 1 relevant finding produced (of up to 4 the fixture suggests) |
| Recommended Actions | PASS -- 3 concrete, non-generic, evidence/hypothesis-linked actions |
| Skeptic Review | PASS -- correct leading hypothesis, substantive challenge, 3 alternatives, concrete falsification test |

See `real-openai-v2-verification/README.md` and `real-openai-v2-verification/evaluation.md` for the
full, criterion-by-criterion writeup, and `real-openai-v2-verification/analysis-result.json` /
`skeptic-review-result.json` for the actual saved (unedited) output. This single real run
demonstrates genuine improvement over the prior `v1` finding recorded in
`docs/requirements-compliance-audit.md` -- it does **not** demonstrate that the underlying gap is
fully closed (see `docs/requirements-compliance-closure.md`, items M32/M38/M39, both marked
`IMPROVED` rather than `RESOLVED` specifically because of this), and it is one call on one scenario,
not a statistically representative sample.

Regular automated tests (`npm test`) never make a real API call, with or without this verification
having been run -- `RUN_REAL_AI_EXPERIMENTS` and a real key are required and are never read by the
test suite itself.
