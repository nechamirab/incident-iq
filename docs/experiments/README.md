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

The files currently committed here were produced by a **mock-only** run
(`npm run ai:experiment`, no `--real` flag). Every real-provider leg is
honestly recorded as `"not-run"` because no real-provider call has been
made in this environment. Running with `--real --provider=openai
--yes` (with `RUN_REAL_AI_EXPERIMENTS=true` and a valid `OPENAI_API_KEY`
configured) would overwrite these files with a genuine real-provider
comparison; see `docs/requirements-compliance-audit.md` and
`docs/requirements-compliance-closure.md` for the project's honest,
current status on whether that has been done.
