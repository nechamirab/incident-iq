# Biases and Logical Fallacies

IncidentIQ's `BiasFinding` schema (`shared/schemas/bias.schema.ts`) recognizes eight reasoning-risk
types: `confirmation-bias`, `anchoring-bias`, `automation-bias`, `post-hoc-fallacy`,
`availability-bias`, `overconfidence-bias`, `hindsight-bias`, `base-rate-neglect`. This document
discusses six of them in depth (the six `MockAIProvider` can deterministically demonstrate) and
notes the remaining two honestly.

**An important honesty note before the specifics:** prior real-OpenAI verification of this project
(`docs/requirements-compliance-audit.md`, item M38) found that real-provider runs under
`incident-analysis-v1` returned `reasoningRisks: []` -- **zero bias findings** -- in all three
tested scenarios, despite the prompt requiring at least three genuinely relevant ones. Every concrete
example below is demonstrated through the deterministic **mock provider's** heuristics
(`MockAIProvider.buildReasoningRisks`), which are grounded in the same real, per-incident evidence
data that ships with the project -- not through real-provider output. This document never claims a
real OpenAI or Anthropic call actually identified any of these biases in a saved run, because no such
saved output exists. `incident-analysis-v2` was written specifically to target this gap (see
`docs/prompts.md`), but no new real-provider verification of `v2` has been run during this
compliance-closure pass -- see `docs/experiments/prompt-comparison/` for the honest current status.

## 1. Confirmation bias

- **Where it appears:** when supporting evidence for a hypothesis is collected but contradicting
  evidence is never actively sought -- an investigator (or a model) that stops looking once a
  plausible story is found.
- **How it affects investigation:** the leading hypothesis gets treated as correct because nothing
  contradicts it, when in fact nothing contradicting was ever looked for.
- **How it's noticed:** `MockAIProvider.buildReasoningRisks` flags this whenever any hypothesis has
  an empty `contradictingEvidenceIds` list -- true for essentially every mock-generated hypothesis,
  since the mock provider itself never populates that field, which is itself an honest
  self-disclosure of the mock's own limitation.
- **How the app reduces it:** `incident-analysis-v2`'s rule 4 explicitly instructs the model to
  *actively search* for contradicting evidence for each hypothesis as a separate step, and rule 6
  requires stating explicitly when none was found after looking (see `docs/prompts.md`). The skeptic
  review's `confirmationBiasAssessment` field exists specifically to have a second AI pass evaluate
  this directly.
- **Remaining limitation:** real-provider testing (`v1`) showed this instruction alone was
  insufficient -- every tested real run returned empty `contradictingEvidenceIds` with no explanation.
  Whether `v2`'s stronger, explicit instruction actually improves this has not yet been verified with
  a real provider call (see the honesty note above).
- **Concrete example:** the `sample-ecommerce-checkout` scenario's leading "pool-size-reduction"
  hypothesis (the v2.4.1 deploy reduced the DB connection pool from 50 to 20) is well-supported by
  three evidence items, but the evaluation fixture (`ecommerceCheckout.eval.ts`) explicitly marks
  `ev-07` (Stripe's own elevated latency, an alternative sufficient explanation) as evidence that
  should challenge it -- exactly the kind of contradiction confirmation bias would skip over.

## 2. Anchoring bias

- **Where it appears:** evidence encountered early, or evidence chronologically close to a
  prominent event (like a deployment), disproportionately shapes the investigation even when it
  later turns out to be a coincidence.
- **How it affects investigation:** the first plausible-looking signal becomes "the story," and later
  evidence gets interpreted to fit it rather than evaluated on its own.
- **How it's noticed:** `MockAIProvider.buildReasoningRisks` flags this whenever evidence is
  timestamped before the incident's recorded `startedAt` -- early evidence can anchor an
  investigation even when it's unrelated.
- **How the app reduces it:** the timeline-plausibility validator (Stage 5;
  `timelinePlausibilityValidator.ts`) separately warns about evidence far outside the incident's
  window without ever auto-rejecting it, keeping pre-incident evidence visible but flagged rather
  than either hidden or silently treated as equally central.
- **Remaining limitation:** the mock heuristic is a simple "before start time" check -- it cannot
  judge whether early evidence is *actually* likely to be related or purely coincidental; that
  judgment is left entirely to the human investigator.
- **Concrete example:** `sample-ecommerce-checkout-ev-10` (a Redis session-cache eviction warning,
  timestamped 10 minutes before the incident's recorded start) and `ev-11` (a feature-flag rollout,
  timestamped even earlier) are both deliberate anchoring-bias bait in that scenario's evaluation
  fixture -- present, timestamped suspiciously close to the incident, but explicitly marked as
  `distractingEvidenceIds`, unrelated to the actual checkout failures.

## 3. Automation bias

- **Where it appears:** trusting an AI-generated analysis specifically *because* it came from an
  automated system, rather than evaluating its actual content.
- **How it affects investigation:** an engineer skips independent verification of an AI hypothesis
  simply because "the tool said so."
- **How it's noticed:** `MockAIProvider.buildReasoningRisks` **always** includes an automation-bias
  finding, honestly disclosing that its own output is a deterministic placeholder produced for local
  development, not a reviewed real-model analysis.
- **How the app reduces it:** every workspace surface that shows AI output also shows its provenance
  (provider, model, prompt version, timestamp) and the quality/completeness warnings attached to it,
  so a user is never looking at a bare conclusion with no context about how much scrutiny it has
  already received. The entire Facts/Assumptions/Hypotheses/Unsupported-Claims separation exists to
  make "was this actually verified" visually unavoidable.
- **Remaining limitation:** this only works if a user actually reads the provenance and warnings
  shown; nothing prevents a user from ignoring them, as discussed in
  `docs/ethical-and-professional-risks.md`, Section 1.
- **Concrete example:** every mock-generated `AnalysisRun` in this project's example artifacts
  (`examples/`) carries this finding by construction -- it is the one bias guaranteed to appear on
  every mock analysis, regardless of which incident is analyzed.

## 4. Post-hoc fallacy ("after this, therefore because of this")

- **Where it appears:** assuming a deployment or configuration change caused an incident merely
  because it happened shortly before the incident started.
- **How it affects investigation:** the most recent change becomes the presumed cause without
  establishing an actual causal mechanism, potentially leading to an unnecessary rollback while the
  real cause continues.
- **How it's noticed:** `MockAIProvider.buildReasoningRisks` flags this whenever any deployment-note
  evidence is present on the incident.
- **How the app reduces it:** both `incident-analysis-v1` and `v2` explicitly instruct the model
  never to treat deployment timing alone as proof of causation (`v2` restates this as rule 11, and
  separately as rule 12 for correlation-vs-causation generally); `v2` additionally asks what
  *additional* evidence would distinguish coincidence from cause.
- **Remaining limitation:** the mock heuristic fires on the mere presence of deployment evidence, not
  on whether the analysis actually reasoned about causation correctly -- it is a coarse proxy, not a
  genuine causal-reasoning check.
- **Concrete example:** `sample-ecommerce-checkout`'s core ambiguity *is* this fallacy: checkout
  failures began minutes after a deploy (`ev-02`), which is highly suggestive but not proof --
  `ev-13` explicitly records that the same error signature had appeared sporadically in the past
  "with no deploy involved," directly undercutting a pure post-hoc conclusion.

## 5. Availability bias

- **Where it appears:** the most numerous or most easily observed evidence type dominates the
  analysis, even if it isn't the most diagnostically important.
- **How it affects investigation:** a source type that happens to log verbosely (e.g. application
  logs) can crowd out a smaller number of more decisive signals (e.g. a single deployment note).
- **How it's noticed:** `MockAIProvider.buildReasoningRisks` flags this when one source type accounts
  for over half of an incident's total evidence (and the incident has a non-trivial evidence count).
- **How the app reduces it:** the Evidence tab is filterable by source type specifically so a user
  can deliberately look past the dominant category; recommended actions in `v2` are required to name
  a specific evidence/hypothesis link rather than defaulting to "look at more of the same."
- **Remaining limitation:** this is a purely statistical proxy (evidence *count* by type), not a
  judgment about diagnostic *importance* -- a single critical log line is not distinguished from a
  hundred routine ones by this heuristic.
- **Concrete example:** `sample-course-registration`'s evidence set contains several `monitoring-alert`
  and `application-log` items describing symptoms (latency, thread-pool exhaustion, CPU) alongside a
  single, easy-to-overlook `deployment-note` (`ev-05`) stating plainly that *no* deployment occurred
  in the prior seven days -- a small but decisive fact that availability bias could cause an
  investigator to under-weight relative to the more numerous symptom-side evidence.

## 6. Base-rate neglect

- **Where it appears:** drawing a confident conclusion from a small amount of evidence without
  accounting for how little evidence that actually is.
- **How it affects investigation:** a hypothesis feels well-supported simply because nothing
  contradicts the few available data points, when the real issue is that there aren't enough data
  points to draw any strong conclusion at all.
- **How it's noticed:** `MockAIProvider.buildReasoningRisks` flags this when an incident has fewer
  than five total evidence items.
- **How the app reduces it:** the evaluation fixtures (Stage 6) deliberately include
  `missingInformationEvidenceIds` for every bundled scenario -- evidence items that explicitly state
  what could not be confirmed due to missing instrumentation, keeping "what we don't know" visible
  rather than implicitly treated as zero risk.
- **Remaining limitation:** the mock heuristic uses a fixed count threshold (5), which is a coarse
  proxy for "enough evidence to be confident" and does not account for evidence *quality* or
  diversity, only quantity.
- **Concrete example:** every one of the six bundled sample incidents includes at least one
  observability-gap evidence item (e.g. `sample-mobile-login-ev-13`: "per-device cache-eviction
  metrics are not instrumented... so it is not possible to directly confirm whether cache eviction...
  is the dominant cause") -- a direct, in-evidence acknowledgment of a base-rate/missing-information
  concern for a human investigator to weigh.

## Overconfidence bias and hindsight bias (documented, not mock-demonstrable)

`overconfidence-bias` and `hindsight-bias` are valid values in the `BiasType` schema and can be
returned by a real model, but `MockAIProvider.buildReasoningRisks` has no heuristic that produces
either of them deterministically -- so neither can be demonstrated through the mock provider today.
The application does address overconfidence indirectly: the quality gate's overconfident-phrase scan
(`analysisQualityEvaluator.ts`, see `docs/ethical-and-professional-risks.md` Section 2) catches
overconfident *language* directly, which is closely related to but not identical to the schema's
`overconfidence-bias` *finding type*. Hindsight bias (retroactively treating an outcome as having
been predictable) has no corresponding mechanism in this codebase at all today. Both are stated here
as an honest gap rather than omitted silently -- see `docs/requirements-compliance-closure.md` for
this item's tracked status.
