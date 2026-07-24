# AI Tools and APIs Used

This document lists every AI tool and API involved in building and running IncidentIQ: which ones
produce the runtime analysis a user sees, and which one was used as a development aid while writing
the project. No tool is listed here unless there is direct evidence it was actually used --
nothing is included speculatively.

## Runtime AI providers (produce the analysis, skeptic review, and postmortem a user sees)

### Mock provider (`MockAIProvider`)

- **What it is:** A fully deterministic, offline, in-process provider -- not a call to any external
  AI service at all. `AI_PROVIDER=mock` is the application's default.
- **Where it's used:** Every AI-facing workflow (analysis, skeptic review, postmortem) when
  `AI_PROVIDER=mock`, including all of this repository's automated tests and the mock-only critical-AI
  experiment results currently committed under `docs/experiments/`.
- **How it works:** Groups an incident's evidence by source type and derives a structured response
  from those clusters directly -- it never reads the prompt text at all (see
  `server/src/ai/providers/MockAIProvider.ts`). This makes it safe, free, and reproducible for
  development, testing, and demonstration, but its output is not evidence that a real language model
  would produce anything similar.
- **Limitations:** cannot demonstrate genuine language understanding, cannot be used for
  prompt-comparison or prompt-sensitivity experiments (its output does not vary with prompt text --
  see `docs/experiments/README.md`), and its "reasoning risks" are template-driven heuristics, not
  learned judgment.

### OpenAI (`OpenAIProvider`, OpenAI Responses API)

- **What it is:** A real large-language-model API (`AI_PROVIDER=openai`), backed by the OpenAI
  Responses API (`client.responses.create`). Configured via `OPENAI_API_KEY`/`OPENAI_MODEL`
  (default `gpt-5.1`).
- **Where it's used:** Same three workflows as the mock provider, when explicitly configured.
- **Verification status:** **Verified with real output in a prior development session.** Real API
  calls were made against three of the bundled sample scenarios, returning `provider: "openai"` and
  `fallbackUsed: false` on every response -- see `docs/requirements-compliance-audit.md` (items M23,
  M32, M38, M39). That verification also surfaced real, honestly-documented gaps in the model's
  output under `incident-analysis-v1` (the prompt version in effect at the time): every hypothesis
  across all three tested scenarios returned an empty `contradictingEvidenceIds`, and
  `reasoningRisks` was empty in all three runs despite the prompt requiring it; `recommendedActions`
  was populated in two of the three runs. `incident-analysis-v2` (see `docs/prompts.md`) was written
  specifically to target these gaps. A limited real-OpenAI verification of `v2` in isolation has
  since been performed (`docs/experiments/real-openai-v2-verification/`, 2026-07-24, one scenario,
  3 real calls, `fallbackUsed: false` throughout): the model's first response reproduced the same
  empty-contradicting-evidence/empty-reasoning-risks pattern, and the targeted completion-repair pass
  then measurably improved both (2 of 3 hypotheses gained contradicting evidence, 1 relevant
  reasoning-risk finding appeared) without fully resolving either. The CLI framework's own head-to-head
  `v1`-vs-`v2` comparison (Experiment A) has **not** been run with a real provider -- the mock-only
  results currently committed under `docs/experiments/prompt-comparison/` still honestly record that
  specific comparison leg as `"not-run"`. Re-running
  `npm run ai:experiment -- --experiment=A --real --provider=openai --yes` with
  `RUN_REAL_AI_EXPERIMENTS=true` and a valid key would produce that evidence.
- **Limitations:** subject to OpenAI's own rate limits/quota/availability; `OpenAIProvider` does not
  use OpenAI's Structured Outputs feature, for reasons documented at length in its own file's doc
  comment (summarized in `docs/architecture.md`, Section 5) -- it sends the required shape as plain
  text in the prompt instead, and relies on this project's own Zod validation and one-shot repair.

### Anthropic (`AnthropicAIProvider`, Anthropic Messages API)

- **What it is:** A real large-language-model API (`AI_PROVIDER=anthropic`), backed by the Anthropic
  Messages API (`client.messages.create`). Configured via `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`
  (default `claude-sonnet-5`).
- **Where it's used:** Same three workflows, when explicitly configured.
- **Verification status:** **Architecturally supported and unit-tested against a mocked SDK client,
  but not verified with a real API call in this project's documented history.**
  `docs/requirements-compliance-audit.md` records real verification only for OpenAI; no equivalent
  Anthropic real-call evidence exists. This is stated honestly rather than assumed from the fact that
  the code path exists -- "architecture support alone is not the same claim as an actual verified
  comparison," the same principle the critical-AI-experiment framework enforces for its own results.
- **Limitations:** same structural caveats as OpenAI (rate limits, no Structured Outputs use), plus
  the added caveat that its real-world output quality for this application has not actually been
  observed.

## Development-time AI tool

### Claude Code (Anthropic)

- **What it is:** An agentic coding assistant (this project's implementation, testing, and
  documentation work across multiple sessions -- including the compliance-closure work this document
  is itself part of -- was performed with Claude Code as the development tool).
- **Purpose:** Used to read and navigate the codebase, implement features and tests, run the test
  suite/linter/typechecker/build, and write documentation such as this file -- a development aid, not
  a runtime component of the shipped application. Claude Code never runs as part of the deployed
  IncidentIQ backend or frontend, and has no relationship to `AI_PROVIDER`/`MockAIProvider`/
  `AnthropicAIProvider`/`OpenAIProvider` above, which are the application's own runtime AI
  integrations.
- **Where it's used:** Development only -- never invoked by any code path in `src/`, `server/src/`,
  or `shared/`.
- **Safety:** As with any development assistant, all code it produced was reviewed, tested (typecheck,
  lint, the automated test suite, and a production build), and is version-controlled like any other
  change; no secrets were ever included in a request to it, consistent with the same "never expose an
  API key" principle enforced throughout the runtime code (see `docs/architecture.md`, Section 9).

## Other AI tools

No other AI tool or API (browser extension, IDE autocomplete plugin, separate chat assistant, etc.)
is documented here because none has direct evidence of use in this repository's history. If another
tool was used informally during development and its use is not reflected in this document, that
omission should be corrected rather than assumed -- this document is intentionally conservative:
it lists only what can be shown to be true from the codebase and the project's own audit trail.
