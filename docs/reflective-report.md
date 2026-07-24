# Reflective Report

**Project name:** IncidentIQ
**Students:** Nechami Rabinovitz and Maayan Vaknin
**Institution:** Hadassah Academic College
**Program:** Computer Science
**Work mode:** Pair project
**GitHub repository:** https://github.com/nechamirab/incident-iq
**Demo video:** [TO BE ADDED AFTER RECORDING]

---

## 1. Project Overview and Purpose

IncidentIQ is an AI-assisted incident-response and root-cause investigation tool. It helps
engineering teams organize incident evidence (logs, monitoring alerts, deployment notes, user
reports), reconstruct a timeline, generate candidate root-cause hypotheses, critically challenge
those hypotheses with a second AI pass, and draft a postmortem — while keeping a human reviewer in
control of every consequential judgment. The system never lets an AI-generated hypothesis present
itself as a confirmed root cause; that status can only ever be set by an explicit human action. The
purpose of the project, beyond satisfying the course brief, was to build something structurally
honest about what an AI assistant can and cannot responsibly claim during a high-pressure
investigation, and to prove that honesty with real, evidence-based testing rather than assertion.

## 2. Professional Context

Production incident response is exactly the kind of high-stakes, time-pressured domain where an
overconfident or hallucinated AI answer is genuinely dangerous: a team that trusts a wrong "root
cause" can roll back the wrong change, page the wrong on-call engineer, or close an incident before
the actual problem is fixed. This project treats that risk as a first-class design constraint rather
than an afterthought — every architectural decision in this codebase (the facts/assumptions split,
the unsupported-claims mechanism, the skeptic review, the human-only hypothesis-confirmation
workflow) exists specifically because of what can go wrong when AI-assisted reasoning tools are used
carelessly in this professional context.

## 3. Objectives

The project's objectives were to: (1) build a real, working full-stack application, not a mockup;
(2) integrate AI in a way that is provider-agnostic, testable without cost, and verifiable with real
providers when desired; (3) make the AI's reasoning auditable — every claim traceable to real
evidence, every unsupported claim visibly demoted rather than hidden; (4) build in mechanisms that
actively work against known AI reasoning failure modes (confirmation bias, overconfidence, treating
correlation as causation); (5) keep a human reviewer in control of every consequential state
transition; and (6) be honest, in both the application's own output and this project's documentation,
about what has and has not actually been verified to work.

## 4. System Architecture

The system is a single repository with three layers: a React/Vite/TypeScript frontend (Material UI,
TanStack Query, Zustand), an Express/TypeScript backend exposing a REST API under `/api`, and a
shared Zod-schema layer (`shared/`) that is the single source of truth for every domain shape used by
both runtimes, so a request/response/domain type can never silently drift between frontend and
backend. The backend's AI integration is centered on a single `AIProvider` interface and one
provider-selection factory (`createAIProvider`), so `analysisService`, `skepticReviewService`, and
`postmortemService` never instantiate a concrete provider themselves and never need a second,
feature-specific way to pick one. Persistence is an in-memory repository behind an interface, chosen
deliberately so a real database could be substituted later without touching calling code — this
project's own honest scope did not include building one. Full details, including the redaction flow,
the validation/repair pipeline, and every human-in-the-loop review point, are in
`docs/architecture.md`.

## 5. Main Features

- Incident intake via pasted, category-labeled evidence and file upload (`.txt`/`.log`/`.json`/`.csv`).
- AI-generated analysis: summary, timeline, facts vs. assumptions, at least three falsifiable
  hypotheses with supporting/contradicting evidence, reasoning risks, recommended actions, open
  questions, and an explicit uncertainty statement.
- A skeptic review: a second, independent AI pass that specifically challenges the leading hypothesis.
- An AI-drafted postmortem, fully human-editable in place, exportable as Markdown.
- Human review controls at every consequential point: fact/assumption review status, hypothesis
  status (including a human-only "confirmed by human" state), skeptic-review notes, and postmortem
  edits.
- A dashboard with search/filter/status-summary across every incident.
- A critical-AI-experiment framework for comparing prompt versions, providers, and prompt variants
  under an explicit safety contract for real, billable calls.

## 6. Technology Stack

Frontend: React, Vite, TypeScript (strict), React Router, Material UI, TanStack Query, Zustand,
React Hook Form, Zod. Backend: Node.js, Express, TypeScript (strict), Multer, the official Anthropic
and OpenAI SDKs, dotenv, Zod. Tooling: ESLint (flat config), Prettier, Vitest, Supertest, npm
workspaces. Every domain and request/response shape is defined once as a Zod schema and consumed via
inferred TypeScript types on both sides of the stack.

## 7. Incident Data and Sample Scenarios

The application ships six entirely synthetic, deliberately ambiguous sample incidents: an e-commerce
checkout failure following a deployment, a course-registration slowdown during a traffic spike, a
mobile-login failure during a signing-key rotation, a database connection leak, a payment-gateway
timeout, and an async-queue backlog. Each has 8 or more evidence items mixing a plausible technical
cause, at least one genuine red herring, and evidence that both supports and challenges the leading
explanation, so no single log line gives away "the answer." Every scenario has a matching, tested
evaluation fixture recording its expected facts, at least three plausible hypotheses (including a
deliberate, evidence-contradicted decoy), which evidence should challenge the leading explanation,
distracting and missing-information evidence, and expected reasoning risks — turning "this scenario
is genuinely ambiguous" from an assertion into something a test suite actually checks.

## 8. How AI Is Used

AI is used for three distinct workflows, each a separate, versioned prompt against a shared,
provider-agnostic pipeline: primary incident analysis, a skeptic review that challenges the leading
hypothesis, and a postmortem draft. Every raw AI response is validated against a strict Zod schema,
checked for evidence-id hallucinations, screened by a provider-independent quality gate for
completeness and overconfident phrasing, and — for schema-valid-but-incomplete analysis
responses — given exactly one further targeted repair attempt limited to the deficient sections. The
system supports three interchangeable providers: a deterministic offline mock (the default, used for
all automated testing), and real integrations with OpenAI and Anthropic.

## 9. Important Prompts and Prompt Versions

The primary analysis prompt has two versions: `incident-analysis-v1` and `incident-analysis-v2`, the
latter now the production default. `skeptic-review-v1` asks the model to challenge the leading
hypothesis specifically, never to restate it. `postmortem-v1` drafts a full postmortem document.
Two repair prompts exist for two different failure modes: `repair-invalid-json-v1` fixes a response
that failed schema validation; `targeted-completion-repair-v1` fixes a schema-valid response that is
merely incomplete in specific, named sections. Full details — purpose, inputs, expected output,
safety rules, and version-to-version changes — are documented in `docs/prompts.md`.

## 10. Prompt Iterations

`v1` was the original analysis prompt. Real-provider testing against OpenAI in an earlier development
session found genuine gaps: every hypothesis across all three tested scenarios came back with an
empty contradicting-evidence list, and `reasoningRisks` came back completely empty in all three runs
despite the prompt requiring it. `v2` was written specifically to target these two gaps — it
instructs the model to actively search for contradicting evidence as a separate, explicit step for
each hypothesis, to state explicitly when none is found after looking, and to ground reasoning risks
in the specific incident's own evidence rather than returning nothing. `v1` was deliberately preserved
unchanged (not deleted or edited in place) specifically so a prompt-comparison experiment can compare
the two directly.

A subsequent, limited real-provider verification (`docs/experiments/real-openai-v2-verification/`,
detailed in Section 19) confirmed `v2` in isolation — not a head-to-head `v1`-vs-`v2` comparison —
against one real OpenAI call on one scenario: the model's first response still reproduced the exact
`v1` regression (empty reasoning risks, empty contradicting evidence on every hypothesis), and the
targeted completion-repair pass then measurably improved both, though not completely. Whether `v2`
is actually *better than `v1`* in a controlled, real-provider, head-to-head comparison remains
unverified — `docs/experiments/prompt-comparison/latest.json` still honestly records that specific
comparison as `"not-run"`, since the verification performed was of `v2` alone, not a paired
comparison against `v1`.

## 11. Evidence Validation and Unsupported Claims

Every evidence id cited anywhere in an AI response — in facts, timeline events, hypotheses'
supporting and contradicting lists, reasoning risks, and recommended actions — is checked against the
incident's real evidence set. A "fact" whose only citation does not resolve to a real evidence id is
never silently discarded: it is moved out of the `facts` collection into a separate
`unsupportedClaims` list, with a validation warning recording exactly why, and the original,
now-invalid evidence reference is preserved for audit rather than deleted. This applies identically
regardless of which provider produced the response, and the postmortem-generation prompt is never
given an unsupported statement to summarize as if it were verified.

## 12. Timeline Reconstruction

Every timeline event from an AI response carries an explicit timestamp-type label
(exact/approximate/inferred/unknown) and a separate `isInferred` flag, shown independently in the
UI, since one does not always imply the other. Timeline events are sorted chronologically at
persistence time on the backend (not only defensively on the frontend), and a separate
plausibility validator produces warnings — never rejections — for events far outside the incident's
recorded window, an inferred timestamp presented as exact, or an invalid chronological relationship.
Legitimate pre-incident or historical evidence (a deployment note from days earlier, for example) is
never treated as automatically invalid by this check.

## 13. Root-Cause Hypotheses

Every analysis proposes at least three distinct, falsifiable hypotheses, each with a confidence score
and an explicit reason for that score, a recommended concrete test, and an expected result. The AI can
only ever leave a hypothesis in a `proposed` state — the AI-facing schema does not even expose a
"confirmed" status value, so there is no code path by which the model could set one, even
accidentally. A human reviewer's own review status (`testing`, `supported`, `weakened`, `rejected`,
or `confirmed-by-human`) is a completely separate, explicit action, and confirming specifically
requires an unambiguous `confirmed: true` signal enforced at the API boundary, not merely a frontend
dialog.

## 14. Supporting and Contradicting Evidence

Hypotheses render supporting and contradicting evidence as two visually distinct groups; an empty
contradicting-evidence list is shown as an explicit, honest "none found" rather than being blank or
absent. As documented in Sections 10 and 19, real-provider testing found this list came back empty
for every hypothesis in every tested run under `v1` — a genuine limitation this project chose to
document rather than hide, and the direct motivation for `v2`'s stronger instruction to actively
search for contradicting evidence. The real `v2` verification run (Section 19) found this **improved
but not resolved**: 2 of 3 hypotheses gained real, fixture-relevant contradicting evidence after the
completion-repair pass — including the leading hypothesis, which cited exactly the evidence item the
evaluation fixture identifies as its correct challenge — while the third hypothesis remained
uncontested despite relevant evidence being available to the model. This is reported as a genuine,
partial improvement, not a resolved regression.

## 15. Skeptic Review

The skeptic review is a second, independent AI pass over the same incident's latest analysis run,
specifically instructed to challenge the leading (highest-confidence) hypothesis rather than restate
or validate it: search for under-weighted alternatives, assess confirmation-bias risk, state a
concrete falsification condition, and recommend further concrete tests. It is persisted as a new,
separate record and never overwrites the original analysis run. The backend — not the model —
determines which hypothesis is leading and which evidence the original run never cited, and supplies
both directly in the prompt, removing an entire class of possible mismatch between what the model is
asked to critique and what it actually critiques. A prior development session verified this workflow
producing real, working output against OpenAI, though that specific real output was not saved as a
committed example — the example artifact in `examples/example-skeptic-review-output.json` is honestly
labeled as mock-provider output instead. Experiment D in `docs/experiments/` scores a skeptic review
against six fixed, mechanically-checkable criteria derived directly from the prompt's own stated
rules, and is meaningful even in mock-only mode since the mock provider's skeptic-review logic is a
genuine, non-trivial function of the run being reviewed.

## 16. Biases and Logical Fallacies

The system recognizes eight reasoning-risk types. Six are deterministically demonstrable through the
mock provider's evidence-grounded heuristics: confirmation bias (a hypothesis with no contradicting
evidence), anchoring bias (evidence predating the incident's recorded start), automation bias (an
honest, always-present disclosure that mock output is a placeholder), the post-hoc fallacy
(deployment evidence present, timing alone is not proof), availability bias (one evidence source type
dominating), and base-rate neglect (very little total evidence). Two — overconfidence bias and
hindsight bias — have no corresponding mock heuristic and are documented as an honest gap rather than
silently omitted. Real-provider testing under `v1` returned zero reasoning-risk findings across all
three tested scenarios, a fact stated plainly rather than glossed over. A real `v2` verification run
(Section 19) reproduced the same empty result on the model's first response, then, after the
targeted completion-repair pass, produced exactly one relevant, evidence-grounded finding
(confirmation bias, tied to the deploy-timing assumption, with a concrete mitigation) — a genuine
improvement from zero, but only one of up to four biases the evaluation fixture identifies as
plausible for that scenario, and from a single real call, not a statistically representative sample.
Full detail, including a concrete sample-scenario example for each of the six, is in
`docs/bias-and-fallacy-analysis.md`.

## 17. Useful AI Outputs

Even from the deterministic mock provider, AI-generated output proved genuinely useful for
structuring an investigation: grouping evidence into coherent hypothesis clusters, generating
concrete, evidence-linked recommended actions instead of generic advice ("check the logs" is
explicitly rejected by the quality gate and by `v2`'s own prompt instructions), and producing a
usable first-draft postmortem that still required human editing but saved the blank-page problem.
The skeptic review's structural approach — always asking "what would falsify this?" — proved useful
as a repeatable discipline independent of which specific incident it was applied to.

## 18. Incorrect, Incomplete, Misleading, or Overconfident AI Outputs

The most significant documented weakness is the real-provider finding described in Sections 10, 14,
and 16: empty contradicting-evidence lists and empty reasoning-risk arrays across every tested real
run under `v1`, despite the prompt explicitly requiring both. This is not a hypothetical concern —
it is a recorded, evidence-based finding from actual API calls (`provider: "openai"`,
`fallbackUsed: false`), and it is exactly the kind of silent incompleteness that could mislead a user
into believing an analysis was more thoroughly self-critical than it actually was, if the UI did not
make an empty list visible as "none found" rather than hiding the section entirely. `recommendedActions`
was also inconsistent across real runs — populated in two of three, empty in one. These findings
directly shaped this project's design: the completeness quality gate and the targeted completion-
repair pass exist specifically because an AI response can be schema-valid and still meaningfully
incomplete.

The real `v2` verification (Section 19) reproduced the same pattern in the model's *raw, first*
response under `v2` — empty reasoning risks, empty contradicting evidence on all three hypotheses —
confirming the underlying model behavior the prompt is fighting against has not disappeared just
because the prompt asks more explicitly. The quality gate and completion-repair pass then measurably
improved the *final* result (one reasoning risk, contradicting evidence on 2 of 3 hypotheses), but
one hypothesis still ended with no contradicting evidence despite relevant evidence being available.
This is reported honestly as a partial, not complete, improvement, based on a single real call on a
single scenario.

## 19. Critical AI Experiments

A repeatable, safe experiment framework (`npm run ai:experiment`, `server/src/experiments/`) supports
four experiments: prompt comparison (`v1` vs. `v2`), provider comparison (mock vs. real), prompt
sensitivity (the standard `v2` prompt vs. a variant instructing the model to argue against the most
obvious apparent cause), and skeptic-review quality against six fixed criteria. It never runs as part
of the automated test suite and makes a real, billable provider call only when explicitly enabled
(`RUN_REAL_AI_EXPERIMENTS=true`, a configured key, `--real`/`--provider` flags, and explicit
approval showing the exact call count) — otherwise it completes entirely in mock-only mode. Because
the mock provider deliberately ignores prompt text (its output is derived purely from an incident's
evidence, by design, so it is fast, free, and deterministic for testing), the prompt-comparison and
prompt-sensitivity experiments are **not meaningful** in mock-only mode; they still run a "pipeline
check" leg proving the schema/validation machinery works for every prompt version, but the actual
comparison is honestly recorded as `"not-run"` in the results currently committed under
`docs/experiments/`, because no real-provider call was made during this compliance-closure pass. The
provider-comparison experiment's mock leg, and the skeptic-review-evaluation experiment (which is
meaningful without a real provider, since the mock skeptic review is a genuine function of the run
being reviewed), both completed and produced real, saved results. This honesty distinction — mock
pipeline validity is not the same claim as a real comparison — is treated as a hard rule throughout
this project, not a minor caveat.

### Real OpenAI verification of `v2` (`docs/experiments/real-openai-v2-verification/`)

Separately from the `ai:experiment` CLI framework above, a limited, one-time real-provider
verification was run directly against the production `analysisService`/`skepticReviewService` code
path (not a simplified experiment harness), against the single bundled `sample-db-connection-leak`
scenario, using a real OpenAI key with `AI_PROVIDER=openai`, `ALLOW_MOCK_FALLBACK=false`. It made
three real, billable calls: one initial incident-analysis call (`incident-analysis-v2`), one targeted
completion-repair call (triggered automatically by the quality gate, not forced), and one
skeptic-review call (`skeptic-review-v1`). No fallback occurred on any call
(`fallbackUsed: false` on every saved result); `provider`/`configuredProvider` both read `"openai"`
throughout.

Results, compared against the scenario's evaluation fixture: all three Facts cited valid evidence
ids and the causal deployment claim correctly remained an Assumption rather than being promoted to a
Fact. Before repair, the model's raw response reproduced the exact `v1`-era regression — an empty
`reasoningRisks` array and every hypothesis with an empty `contradictingEvidenceIds`. After the
(automatically triggered, single) completion-repair pass: one relevant, evidence-grounded
confirmation-bias finding was generated, two of three hypotheses gained real, fixture-relevant
contradicting evidence (including the leading hypothesis), and three concrete, non-generic,
evidence/hypothesis-linked recommended actions were present. No unknown or invented evidence ids
appeared anywhere in either result, and the skeptic review correctly identified the leading
hypothesis, challenged it substantively, proposed three alternative explanations, named confirmation
bias, and stated a concrete falsification test.

**Limitations, stated plainly:** contradicting evidence remained empty for one of the three
hypotheses even after repair; only one of the evaluation fixture's several plausible reasoning-risk
types was actually produced; and this verification used a single scenario and a single real call per
flow — it is not a statistically representative sample, and a different real call could plausibly
produce a different result, since LLM output is not deterministic. This verification demonstrates
real, measurable improvement over the prior `v1` finding — it does not demonstrate that M32
(contradicting evidence) or M38 (reasoning risks) are fully solved, and this report does not claim
either is. Full saved evidence, including the raw pre-repair response for direct comparison, is in
`docs/experiments/real-openai-v2-verification/` — see that directory's `evaluation.md` for the
complete, criterion-by-criterion breakdown.

## 20. Problems Encountered and Solutions

Several concrete engineering problems came up during this compliance-closure work. Introducing the
targeted completion-repair pass initially broke dozens of existing tests because a shared test
fixture's default response had an empty `reasoningRisks` array, triggering an unwanted extra repair
call in every test using it — solved by giving the fixture a non-empty default and adding an explicit
override parameter for the specific tests that needed an empty case. A redaction unit test
unexpectedly matched two different redaction rules at once due to regex word-boundary behavior around
an underscore-prefixed key name — solved by choosing a test input where only the intended rule's
boundary condition held. A CSV-validation bug filtered out an intentionally blank header row before
the emptiness check could run, because the blank-row filter was applied to all rows including the
header instead of only the data rows — solved by extracting headers unconditionally before filtering.
Building the evaluation fixtures for the three original sample incidents required first recognizing
that none of their evidence had a null/approximate timestamp, which the shared fixture test suite
requires at least one of — solved by adding two new, deliberately null-timestamp evidence items
(a "prior occurrences, not tracked" note and an "observability gap" note) to each of the three
original incidents, mirroring the pattern already used by the three newer scenarios, rather than
weakening the shared test suite's requirement.

## 21. Privacy, Security, and Redaction

Before any request reaches a real AI provider, its prompt passes through a redaction step that
returns a brand-new, redacted copy — the original prompt object, and the incident evidence it was
built from, are never mutated, so everything stored locally and shown in the UI remains the original
text. Detected categories include email addresses, bearer tokens, well-known API-key prefixes,
several kinds of labeled secret key-value pairs, authorization headers, cookie values, and
card-number-shaped digit runs. Only safe, aggregate metadata (whether redaction applied, how many
values, which categories) is ever recorded — never the removed values themselves — and the mock
provider never redacts at all, since nothing it does leaves the process. This is explicitly
documented as a prototype-level safeguard against common accidental leaks, not a production
data-loss-prevention system: it cannot do named-entity recognition, cannot understand semantic
context, and cannot catch a secret in a shape it was not written to recognize.

## 22. Ethical and Professional Risks

Beyond the technical redaction mechanism, this project documents (in `docs/ethical-and-professional-risks.md`)
its position on over-trust risk, why the system is designed to never let AI output claim a definitive
root cause, how uncertainty is communicated (confidence scores paired with reasons, a mandatory
uncertainty statement, and independent timestamp-type/inferred labeling), and who bears
responsibility if a user acts on a harmful AI recommendation without applying their own judgment. The
honest position taken throughout is that software design can make good practice easy and bad practice
visible, but cannot fully prevent a team from ignoring both — a governance question no single
application can resolve by itself.

## 23. Human Judgment and Responsibility

Every consequential state transition in this system requires an explicit human action: marking a
fact or assumption's review status, transitioning a hypothesis's status (especially to
`confirmed-by-human`, which requires an explicit confirmation dialog and is enforced server-side, not
just in the UI), recording independent notes on a skeptic review, and editing a postmortem draft in
place. The AI never executes a recommended action automatically; it only ever proposes an
investigative step for a human to read, evaluate, and choose to act on or not.

## 24. Testing and Quality Assurance

The project has 858 automated tests (709 backend, 149 frontend) — this compliance-closure pass alone
added coverage for unsupported-fact handling, the `v2` prompt and completion-repair pass, the human
hypothesis-review workflow end to end, redaction (per category, both real providers), file-upload
hardening, timeline sorting/plausibility, evaluation fixtures for all six sample incidents, and the
critical-AI-experiment framework's pure logic. Both real providers (`AnthropicAIProvider`,
`OpenAIProvider`) have dedicated unit-test suites against a mocked SDK client covering the full
authentication/rate-limit/quota/network/timeout/refusal failure taxonomy; the regular automated suite
makes no real network calls and needs no API key. See Section 10 of `docs/requirements-compliance-closure.md`
for the exact final test/build/lint results of this pass.

## 25. Known Limitations

No real database — all data is lost on backend restart. No authentication or authorization — this is
a single-tenant prototype. No component-level frontend test suite (no React Testing Library
installed). Real-provider verification exists only for OpenAI, not Anthropic. Two of the eight
reasoning-risk types have no mock heuristic. Redaction is prototype-level, not production DLP. The
prompt-comparison and prompt-sensitivity experiments require a real provider to be meaningful and have
not been re-run with one during this pass. The demo video has not yet been recorded. A complete,
itemized list is in the README's "Known limitations" section and `docs/requirements-compliance-closure.md`.

## 26. Future Improvements

The most valuable next step is re-running the critical-AI-experiment framework with a real OpenAI (and
ideally Anthropic) key to obtain genuine `v1`-vs-`v2` and mock-vs-real comparison data, since that is
the one piece of evidence this project's own honesty standard requires but does not yet have for the
current prompt version. Beyond that: a real persistence layer, authentication/authorization for
multi-user use, a production-grade redaction/DLP integration, component-level frontend tests, and
mock heuristics (or documented real-provider evidence) for the two currently-undemonstrated bias
types.

## 27. Division of Work

This was a pair project. Both students collaborated throughout on the full-stack system architecture,
frontend and backend implementation, AI-provider integrations for the mock, Anthropic, and OpenAI
providers, the shared TypeScript models and Zod-schema validation, the incident-analysis and
evidence-validation logic, sample-incident scenario design, testing/QA and evaluation of AI-generated
results, and documentation and project review. No more granular individual breakdown, ownership of a
specific provider or component, or contribution percentage is claimed here beyond this description.

## 28. Conclusion

IncidentIQ set out to prove that an AI-assisted investigation tool can be built to actively work
against, rather than amplify, the specific ways AI reasoning tends to fail in a high-pressure
domain — and to prove that claim with real, checkable evidence rather than assertion. The project's
own real-provider testing found genuine gaps (empty contradicting evidence, empty reasoning risks)
in its first prompt version, and rather than hide that finding, this project documented it,
designed a second prompt version specifically to address it, built a repeatable experiment framework
to measure whether that fix actually works, and was honest in every piece of documentation about
which of those things has and has not yet been verified with a real provider call. That combination —
a real, working system, and an unusually rigorous insistence on only claiming what has actually been
demonstrated — is the project's core contribution.

## 29. GitHub Repository Link

https://github.com/nechamirab/incident-iq

## 30. Demo Video Link

[TO BE ADDED AFTER RECORDING]
