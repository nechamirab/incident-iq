# Reflective Report

**Project name:** IncidentIQ
**Students:** Nechami Rabinovitz and Mayan Vaknin
**Institution:** Jerusalem Multidisciplinary College
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

Production incident response is a high-stakes, time-pressured domain where an overconfident or
hallucinated AI answer is genuinely dangerous: a team trusting a wrong "root cause" can roll back the
wrong change, page the wrong engineer, or close an incident before the real problem is fixed. This
project treats that risk as a first-class design constraint, not an afterthought — the
facts/assumptions split, the unsupported-claims mechanism, the skeptic review, and the human-only
hypothesis-confirmation workflow all exist because of what can go wrong when AI-assisted reasoning
tools are used carelessly here.

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

The system is one repository with three layers: a React/Vite/TypeScript frontend (Material UI,
TanStack Query, Zustand), an Express/TypeScript backend exposing a REST API under `/api`, and a
shared Zod-schema layer (`shared/`) that is the single source of truth for every domain shape, so
request/response/domain types can never drift between frontend and backend. AI integration is
centered on one `AIProvider` interface and one provider-selection factory (`createAIProvider`), so no
service ever instantiates a concrete provider itself. Persistence is an in-memory repository behind
an interface, deliberately chosen so a real database could later be substituted without touching
calling code — building one was outside this project's honest scope. Full details are in
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
checkout failure, a course-registration slowdown, a mobile-login failure, a database connection leak,
a payment-gateway timeout, and an async-queue backlog. Each has 8+ evidence items mixing a plausible
cause, at least one genuine red herring, and evidence that both supports and challenges the leading
explanation, so no single log line gives away "the answer." Every scenario has a matching, tested
evaluation fixture recording expected facts, at least three plausible hypotheses (including an
evidence-contradicted decoy), challenging/distracting/missing-information evidence, and expected
reasoning risks — turning "genuinely ambiguous" from an assertion into something a test actually
checks.

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
despite the prompt requiring it. `v2` was written to target these two gaps specifically: it instructs
the model to actively search for contradicting evidence as a separate, explicit step for each
hypothesis, to state explicitly when none is found after looking, and to ground reasoning risks in
the specific incident's own evidence rather than returning nothing. `v1` was deliberately preserved
unchanged so a controlled comparison could be run later.

**A controlled `v1`-vs-`v2` comparison, plus a prompt-sensitivity test, were completed as real OpenAI
calls** (`docs/experiments/reflective-report-completion/`, 2026-07-24, `sample-db-connection-leak`,
`gpt-4o-mini`, same repair-eligible pipeline for every leg): one new real `v1` call, one new real call
using a `v2` variant instructed to "argue against the first apparent cause" before ranking hypotheses,
and the already-saved real `v2` call reused as the third leg. Results, in full in
`docs/experiments/reflective-report-completion/comparison.md`:

- **Contradicting evidence:** identical in all three -- 0 of 3 hypotheses populated in every raw
  response, 2 of 3 after repair in every final result. `v2`'s stronger instruction did not produce a
  different outcome than `v1` here, once completion repair is applied to both.
- **Reasoning risks:** *not* consistent. `v2`'s raw response reproduced the documented empty-array
  regression again; `v1`'s raw response had 1 finding, and the sensitivity variant's had 2 -- the
  opposite of what `v2` was designed to improve, in this one-call sample. This shows the regression is
  not deterministic even for the same prompt, and that a single real call cannot reliably distinguish
  the prompts on this criterion.
- **Leading hypothesis:** identical across all three (the traffic-increase explanation), despite the
  sensitivity variant's explicit instruction to argue against the obvious cause first.
- **Everything else** (facts, assumptions, supporting evidence, recommended actions, unknown
  references, certainty language) was indistinguishable across all three.

**Honest conclusion:** this data does not support a claim that `v2` measurably outperforms `v1`, and
this report does not make that claim. The prompt-sensitivity variant changed the model's *raw*
reasoning content (more reasoning risks, more detailed confidence explanations) without changing its
final leading conclusion. Both results are one real call per version on one scenario -- not
statistically representative, and stated as such rather than overstated.

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
absent. As documented in Sections 10 and 19, the three earlier real-provider v1 analyses returned empty
contradicting-evidence lists for every hypothesis. In the later controlled v1 comparison, the raw response
reproduced the same issue, while the completion-repair pass added valid contradicting evidence to two of
the three hypotheses. This limitation was documented rather than hidden and directly motivated v2's stronger
instruction to actively search for contradicting evidence. The real `v2` verification run (Section 19) found
this **improved but not resolved**: 2 of 3 hypotheses gained real, fixture-relevant contradicting evidence
after the completion-repair pass — including the leading hypothesis, which cited exactly the evidence item the
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
asked to critique and what it actually critiques. Three distinct kinds of skeptic-review evidence now
exist in this repository, clearly labeled and never conflated: a **real, saved OpenAI skeptic-review
artifact** (`docs/experiments/real-openai-v2-verification/skeptic-review-result.json`, 2026-07-24 --
see Section 19 for its findings); a **deterministic mock example**
(`examples/example-skeptic-review-output.json`), explicitly labeled as mock-provider output, kept for
schema illustration, never presented as real-model output; and **automated mock-provider testing**
(Experiment D, `docs/experiments/`), which scores a skeptic review against six fixed,
mechanically-checkable criteria derived from the prompt's own stated rules and is meaningful in
mock-only mode since the mock provider's skeptic-review logic is a genuine, non-trivial function of
the run being reviewed.

## 16. Biases and Logical Fallacies

The system's schema recognizes eight reasoning-risk types. This section reflects on five as genuine
human/AI reasoning risks encountered while building and testing this project against
`sample-db-connection-leak` -- not only as mock-provider implementation heuristics. The real finding
that `v2`'s first raw OpenAI response had **zero** reasoning risks, and that the completion-repair
pass then produced exactly **one** relevant confirmation-bias finding, is preserved below and in
Section 19; full per-bias detail, including a worked example for each of six schema types, is in
`docs/bias-and-fallacy-analysis.md`.

<!-- docx-page-break-before: keeps the table header and its first data row together on one page -->

| Bias / Fallacy | Where It Appeared | Effect on Our Thinking | How We Noticed It | How We Reduced Its Effect |
| --- | --- | --- | --- | --- |
| **Confirmation bias** | The deploy at 09:35 UTC correlates neatly with errors starting at 09:40 -- an easy story to settle on and stop questioning. | Risk of collecting evidence *for* the deploy explanation while never actively hunting for evidence against it. | A real OpenAI `v2` raw response left every hypothesis's `contradictingEvidenceIds` empty -- confirmation bias made concrete: support gathered, contradictions never sought. | Facts vs. Assumptions keeps the causal claim an Assumption, never a Fact; completion repair explicitly re-asks for contradicting evidence; Skeptic Review's `confirmationBiasAssessment` targets this directly. |
| **Post-hoc fallacy** | Deploy at 09:35, errors at 09:40 -- five minutes apart, a classic "this, therefore because of this" trap. | Timing proximity alone can feel like causal proof, crowding out an equally valid alternative (the traffic increase); the causal claim is kept as an Assumption, never a Fact, specifically to guard against this. | The post-hoc risk was identified through the scenario design, the evaluation fixture, and the investigation review process. However, it was not consistently named by every real OpenAI response: `v1` and the sensitivity variant both flagged it explicitly (citing the deploy/error evidence ids), but the saved `v2` run's only reasoning-risk finding was `confirmation-bias`, not `post-hoc-fallacy` -- demonstrating that a relevant reasoning risk may still be missed even when the evidence clearly supports it. | `v2`'s prompt explicitly forbids treating deployment timing alone as causation and forbids presenting correlation as proven causation; the mock provider flags it whenever deployment evidence is present; the Skeptic Review and contradicting-evidence checks provide an independent second look regardless of whether the first pass named the bias. |
| **Anchoring bias** | Evidence `ev-10` ("this alert has fired before, unrelated to any deploy") is easy to skim past once the deploy narrative already feels settled. | The first plausible story anchors the whole investigation; later evidence gets under-weighted rather than evaluated fresh. | A design risk identified directly, not one a real call happened to name for this scenario. | The mock heuristic flags evidence timestamped before the incident's recorded start; every citation is a clickable chip so no item is easy to silently skip. |
| **Base-rate neglect** | The same alert had fired 3-4 times before over two months, always self-resolving -- easy to discount in favor of a specific, current-feeling cause. | A routine, previously self-resolving alert can get treated as a novel emergency needing a specific root cause. | Deliberately built into the scenario's evidence and evaluation fixture, to test whether an investigation accounts for it. | The mock provider flags base-rate neglect on sparse evidence; every scenario's evaluation fixture requires a base-rate/missing-information element to be present and checked by the test suite. |
| **Automation bias** | Every screen presenting AI output, including the deterministic mock provider's. | Trusting a conclusion because a tool produced it, without the scrutiny a colleague's opinion would get. | This risk motivated `MockAIProvider`'s design choice to always disclose "this is mock output" as its own finding, before any real call was ever made. | Provider/model/prompt-version metadata on every result; the Facts/Assumptions/Unsupported-Claims split; the human-only `confirmed-by-human` status the AI can never set itself. |

**Remaining limitations, stated honestly:** none of the three controlled comparison outputs for this scenario explicitly named base-rate neglect, despite the trap being present -- a real gap,
not glossed over. The completion-repair pass improved contradicting evidence for 2 of 3 hypotheses,
never 3 of 3, in every real run tested. No mechanism can force a human reviewer to actually act on a
flagged anchoring or automation-bias risk -- the tool surfaces these, but responsibility to act on
them remains human (Section 22).

## 17. Useful AI Outputs

Concrete, verified examples from the real OpenAI verification
(`docs/experiments/real-openai-v2-verification/`), not general description: the model correctly kept
"the deploy caused the connection-pool exhaustion" as an **Assumption**, never promoting it to a
Fact, despite the tempting timing correlation. All three accepted Facts cited valid evidence ids, with
zero unsupported claims. The final analysis produced three concrete, non-generic Recommended Actions
(e.g. analyzing per-request connection-hold-time metrics against a named hypothesis, not "check the
logs"). The real Skeptic Review challenged the leading hypothesis substantively, proposed three
plausible alternatives (including a base-rate-neglect angle -- "this has happened before without a
deploy"), identified a concrete falsification test, and correctly cited four ignored evidence ids the
original analysis never referenced. Each of these was genuinely useful to an engineer reading the
output: they point at exactly what to check next, not generic advice, and the Assumption/Fact split
tells a reader precisely how much to trust each claim before acting on it.

The deterministic **mock provider** (never genuinely AI-generated -- labeled as such throughout this
report) was separately useful as a free, reproducible testing aid: grouping evidence into coherent
hypothesis clusters, generating concrete evidence-linked actions for automated tests, and producing a
usable first-draft postmortem structure. It is discussed here only as infrastructure, not as evidence
of AI reasoning quality.

## 18. Incorrect, Incomplete, Misleading, or Overconfident AI Outputs

The most significant documented weakness is the real-provider finding described in Sections 10, 14,
and 16. In the three earlier real-provider `v1` runs (a prior development session, three different
scenarios), the model returned empty reasoning-risk arrays and empty contradicting-evidence lists,
despite the prompt explicitly requiring both. In the later controlled comparison (Section 10), the
new `v1` run on `sample-db-connection-leak` returned one reasoning-risk finding, showing that the
behavior was inconsistent rather than universal — a real model does not fail the same way every
time, and this report does not claim otherwise. This is not a hypothetical concern — it is a
recorded, evidence-based finding from actual API calls (`provider: "openai"`, `fallbackUsed: false`),
and it is exactly the kind of silent incompleteness that could mislead a user into believing an
analysis was more thoroughly self-critical than it actually was, if the UI did not make an empty list
visible as "none found" rather than hiding the section entirely. `recommendedActions` was also
inconsistent across the earlier real runs — populated in two of three, empty in one. These findings
directly shaped this project's design: the completeness quality gate and the targeted completion-
repair pass exist specifically because an AI response can be schema-valid and still meaningfully
incomplete, and because that incompleteness is not consistent enough to predict or rule out in
advance.

The real `v2` verification (Section 19) reproduced the same pattern in the model's *raw, first*
response under `v2` — empty reasoning risks, empty contradicting evidence on all three hypotheses —
confirming the underlying model behavior the prompt is fighting against has not disappeared just
because the prompt asks more explicitly. The quality gate and completion-repair pass then measurably
improved the *final* result (one reasoning risk, contradicting evidence on 2 of 3 hypotheses), but
one hypothesis still ended with no contradicting evidence despite relevant evidence being available.
This is reported honestly as a partial, not complete, improvement, based on a single real call on a
single scenario.

The follow-up `v1`-vs-`v2`-vs-sensitivity comparison (Section 10,
`docs/experiments/reflective-report-completion/`) sharpens this picture rather than resolving it:
whether the raw response improved under `v2` depended entirely on which specific real call happened
to run -- `v2`'s raw response had the fewest reasoning risks (zero) of the three versions tested, and
the improvement that did occur (contradicting evidence on 2 of 3 hypotheses) came from completion
repair identically in all three versions, not from the prompt wording itself. The small "argue
against the first cause" variation changed the model's raw reasoning content but not its final
leading conclusion. **`v2` is not shown to be more effective than `v1` by this data** -- the honest
finding is that improvement depended mainly on the completion-repair pass, not on the prompt version,
and one hypothesis remained uncontested in every version tested.

## 19. Critical AI Experiments

A repeatable, safe experiment framework (`npm run ai:experiment`, `server/src/experiments/`) supports
four experiments: prompt comparison (`v1` vs. `v2`), provider comparison (mock vs. real), prompt
sensitivity (standard `v2` vs. an "argue against the obvious cause" variant), and skeptic-review
quality against six fixed criteria. It never runs as part of the automated test suite and makes a
real, billable call only when explicitly enabled (`RUN_REAL_AI_EXPERIMENTS=true`, a configured key,
`--real`/`--provider` flags, explicit approval) — otherwise it runs entirely mock-only. Since the mock
provider ignores prompt text by design, its prompt-comparison and prompt-sensitivity legs are **not
meaningful** in mock-only mode. The **CLI framework's own** Experiment A/C legs still honestly record
`"not-run"` — they have not been re-run with `--real`. A real `v1`-vs-`v2` comparison and
prompt-sensitivity test **were** completed via a separate, standalone script exercising the same
pipeline directly (see the subsection below). The provider-comparison mock leg and the
skeptic-review-evaluation experiment (meaningful without a real provider) both produced real, saved
results. This distinction — mock pipeline validity is not a real comparison — is a hard rule
throughout this project.

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

### Real prompt comparison and prompt-sensitivity test (`docs/experiments/reflective-report-completion/`)

A controlled `v1`-vs-`v2` comparison and a prompt-sensitivity test were completed as real OpenAI
calls, using the same scenario, model, and repair-eligible pipeline as the verification above: one
new real `v1` call (2 real requests: initial + completion-repair) and one new real call using a `v2`
variant instructed to argue against the first apparent cause before ranking hypotheses (2 real
requests), reusing the existing `v2` result as the third leg rather than duplicating it. Summarized
in Section 10; full criterion-by-criterion detail, including the honest conclusion that this data
does not show `v2` outperforming `v1`, is in
`docs/experiments/reflective-report-completion/comparison.md`.

## 20. Problems Encountered and Solutions

Several concrete engineering problems came up during this project. Introducing the targeted
completion-repair pass broke dozens of existing tests because a shared test fixture's default
response had an empty `reasoningRisks` array, triggering an unwanted extra repair call in every test
using it — solved by giving the fixture a non-empty default plus an explicit override for tests that
specifically needed an empty case. A redaction unit test matched two different redaction rules at
once due to regex word-boundary behavior around an underscore-prefixed key name — solved by choosing
a test input where only the intended rule's boundary condition held. A CSV-validation bug filtered
out an intentionally blank header row before the emptiness check could run — solved by extracting
headers unconditionally before filtering data rows. Building evaluation fixtures for the three
original sample incidents required recognizing none of their evidence had a null/approximate
timestamp, which the shared fixture test suite requires — solved by adding two deliberately
null-timestamp evidence items to each, mirroring the pattern already used by the newer scenarios,
rather than weakening the test suite's requirement.

### Lessons Learned

- Valid JSON is not the same as high-quality reasoning -- a schema-valid response can still have
  empty reasoning risks and no contradicting evidence, which is exactly what real testing found.
- Schema validation cannot detect every meaningful omission; a provider-independent quality gate and
  a separate, targeted repair pass were needed to catch and address completeness, not just structure.
- A model can satisfy structure while omitting self-critical content -- the two failures are
  different and need different mechanisms, not one bigger schema.
- Real-provider testing is necessary because mock success proves nothing about real-model behavior --
  every automated test passed throughout this project while the real regressions this report
  documents were still present.
- Prompt wording alone cannot guarantee complete reasoning: the real `v1`-vs-`v2` comparison (Section
  10) found the stronger `v2` instructions did not reliably outperform `v1` in a single-call sample.
- Human review remains necessary even after every automated safeguard here -- confirmation bias,
  anchoring, and automation bias are risks the system can surface but never fully close on its own.

## 21. Privacy, Security, and Redaction

Before any request reaches a real AI provider, its prompt passes through a redaction step that
returns a brand-new, redacted copy — the original prompt and evidence are never mutated, so local
storage and the UI always show the original text. Detected categories include email addresses,
bearer tokens, well-known API-key prefixes, labeled secret key-value pairs, authorization headers,
cookie values, and card-number-shaped digit runs. Only safe, aggregate metadata (whether redaction
applied, how many values, which categories) is ever recorded — never the removed values — and the
mock provider never redacts at all, since nothing it does leaves the process. This is explicitly
documented as a prototype-level safeguard, not production DLP: no named-entity recognition, no
semantic context, no catching a secret in a shape it wasn't written to recognize.

## 22. Ethical and Professional Risks

`docs/ethical-and-professional-risks.md` documents this project's position on over-trust risk, why
the system never lets AI output claim a definitive root cause, how uncertainty is communicated
(confidence scores paired with reasons, a mandatory uncertainty statement, independent
timestamp-type/inferred labeling), and who bears responsibility if a user acts on a harmful
recommendation without applying their own judgment. The honest position taken throughout: software
design can make good practice easy and bad practice visible, but cannot fully prevent a team from
ignoring both — a governance question no application can resolve by itself.

## 23. Human Judgment and Responsibility

Every consequential state transition in this system requires an explicit human action: marking a
fact or assumption's review status, transitioning a hypothesis's status (especially to
`confirmed-by-human`, which requires an explicit confirmation dialog and is enforced server-side, not
just in the UI), recording independent notes on a skeptic review, and editing a postmortem draft in
place. The AI never executes a recommended action automatically; it only ever proposes an
investigative step for a human to read, evaluate, and choose to act on or not.

## 24. Testing and Quality Assurance

The project has **890 automated tests** (709 backend, 181 frontend), verified by actually running
`npm run test` while finalizing this report, not carried forward from an earlier count. Coverage
spans unsupported-fact handling, the `v2` prompt and completion-repair pass, the human
hypothesis-review workflow end to end, redaction (per category, both real providers), file-upload
hardening (including client-side content validation, not just extension/size), timeline
sorting/plausibility, evaluation fixtures for all six sample incidents, and the critical-AI-experiment
framework's pure logic. Both real providers (`AnthropicAIProvider`, `OpenAIProvider`) have dedicated
unit-test suites against a mocked SDK client covering the full authentication/rate-limit/quota/
network/timeout/refusal failure taxonomy; the regular automated suite makes no real network calls and
needs no API key, whether or not a real-provider verification has been run separately.

## 25. Known Limitations

No real database — all data is lost on backend restart. No authentication or authorization — this is
a single-tenant prototype. No component-level frontend test suite — confirmed by inspecting current
dependencies while finalizing this report: no React Testing Library, jsdom, or equivalent is
installed anywhere in the repository, so this remains an accurate, current limitation, not a stale
one. Real-provider verification exists only for OpenAI, not Anthropic. Two of the eight reasoning-risk
types have no mock heuristic. Redaction is prototype-level, not production DLP. The `v1`-vs-`v2` and
prompt-sensitivity comparisons have now been run once each with a real provider (Section 10) — but on
a single scenario with a single call per version, so they remain a limited, non-statistically-
representative sample, not a settled comparison. The demo video has not yet been recorded. A complete,
itemized list is in the README's "Known limitations" section and `docs/requirements-compliance-closure.md`.

## 26. Future Improvements

The most valuable next step is repeating the `v1`-vs-`v2` and prompt-sensitivity real-provider
comparisons across multiple calls and multiple scenarios, since the single-call, single-scenario
sample completed for this report (Section 10) is not statistically representative and left the
question of whether `v2` reliably outperforms `v1` genuinely open. A real Anthropic verification (only
OpenAI has been tested with a real call) would close a second documented gap. Beyond that: a real
persistence layer, authentication/authorization for multi-user use, a production-grade
redaction/DLP integration, component-level frontend tests, and mock heuristics (or documented
real-provider evidence) for the two currently-undemonstrated bias types.

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
