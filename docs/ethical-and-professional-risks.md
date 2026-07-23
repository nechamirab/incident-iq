# Ethical and Professional Risks

This document answers the project brief's questions about the ethical and professional risks of
using AI in an incident-investigation tool, grounded in the actual mechanisms this codebase
implements (not aspirational statements) and honest about their limits.

## 1. Risk of over-trusting AI output

**The risk:** an engineer under incident pressure treats a plausible-sounding AI hypothesis as
already confirmed, skipping the verification step it was designed to prompt.

**What the application does about it:**

- Every AI response is split into **facts** (evidence-cited), **assumptions** (plausible but
  unproven), **hypotheses** (falsifiable, always paired with a confidence score and a recommended
  test), and **unsupported claims** -- rendered as visually distinct groups in the UI, never mixed
  (`shared/schemas/reasoning.schema.ts`, `FactsAssumptionsSection.tsx`).
- A "fact" whose only supporting evidence id is not real is automatically demoted out of `facts` and
  into `unsupportedClaims`, with the reason recorded as a validation warning
  (`unsupportedClaimDetector.ts`, `mapAnalysisResponse.ts`) -- this applies identically across mock
  and real providers.
- `automation-bias` is one of the reasoning risks the system can flag about its own output (e.g.
  `MockAIProvider` always flags it for itself); the whole "Reasoning Risks" tab exists specifically
  to surface ways the *analysis itself* might be wrong, not only ways the incident might be.
- A hypothesis can never be marked `confirmed-by-human` by the AI -- the AI-facing schema does not
  even expose that status value, and the human-review endpoint additionally requires an explicit
  `confirmed: true` in the request body (see Section 3, and `docs/architecture.md` Section 7).

**Documented limitation:** these mechanisms reduce, but cannot eliminate, over-trust risk -- a user
who ignores the UI's distinctions and acts on a hypothesis as if it were confirmed is still possible.
No software control can substitute for an organization's own incident-review discipline.

## 2. Risk of the AI stating a definitive root cause

**The risk:** a confidently-worded AI response gets treated as an authoritative verdict rather than
an investigative aid.

**What the application does about it:**

- Every analysis and skeptic-review prompt explicitly instructs the model to avoid certainty
  language ("definitely", "proves", "the root cause is", "confirmed") in favor of hedged phrasing
  ("the available evidence suggests", "a possible explanation is", "this has not been verified") --
  see `docs/prompts.md`.
- The quality gate (`analysisQualityEvaluator.ts`) scans every response for a fixed list of
  overconfident phrases (`"definitely caused"`, `"the definitive root cause"`, `"100% certain"`,
  etc.) and raises a `qualityWarnings` entry if any appear -- an advisory signal surfaced to a human
  reviewer, not a silent auto-correction.
- The postmortem prompt is explicitly instructed to use "likely cause" language unless a hypothesis
  already carries `status: 'confirmed-by-human'` -- a status only a human review action can set (see
  Section 3).
- Real-provider verification found this instruction was followed in practice during prior real
  OpenAI testing (no overconfident-phrase findings were reported in
  `docs/requirements-compliance-audit.md`), though the same testing found other gaps (empty
  `reasoningRisks`/`contradictingEvidenceIds` under `incident-analysis-v1`) -- see
  `docs/ai-tools-and-apis.md` for the full, honest account.

**Documented limitation:** hedged language is a prompt instruction, not a hard guarantee -- a model
could still phrase something more confidently than intended despite the instruction and the
after-the-fact quality-warning check; the quality gate catches only the specific phrases it checks
for, not every possible overconfident construction.

## 3. Communicating uncertainty and confidence honestly

**What the application does:**

- Every hypothesis carries an explicit numeric `confidence` (0-100) *and* a `confidenceReason`
  explaining what that number is based on -- the UI shows confidence as a progress bar, a numeric
  value, *and* a text descriptor ("Moderate confidence") simultaneously, never color alone.
- Every analysis response includes a mandatory `uncertaintyStatement` field; the quality gate flags
  one that is missing or under 15 characters as incomplete, and the targeted completion-repair pass
  (see `docs/prompts.md`) can specifically request a substantive one.
- Timeline events carry an explicit `timestampType` (`exact`/`approximate`/`inferred`/`unknown`) and
  a separate `isInferred` boolean, shown independently in the UI -- a timestamp being of type
  "approximate" and a timestamp being flagged `isInferred` are shown as two separate signals, since
  one doesn't always imply the other.
- The human hypothesis-review workflow (`PATCH .../hypotheses/:id/status`) lets a reviewer
  explicitly downgrade a hypothesis to `weakened` or `rejected`, or promote it only after their own
  verification to `confirmed-by-human` -- the system's confidence language is never the last word.

## 4. What should never be sent to an external AI provider

**The application's position:** raw incident evidence pasted or uploaded by a user may legitimately
contain accidentally-included secrets (a credential embedded in a log line, an email address in a
support message, a bearer token pasted into a stack trace) that should never leave the process
unredacted, even though the evidence itself is meant to be analyzed.

**What the application does about it:**

- `redactPromptForExternalProvider` (`server/src/ai/redactSensitiveContent.ts`) runs immediately
  before a real provider's SDK request is constructed, targeting emails, bearer tokens, well-known
  API-key prefixes, password/secret/access-token/refresh-token/session-id key-value pairs,
  authorization headers, cookie values, and card-number-shaped digit runs -- see
  `docs/architecture.md`, Section 5 for the full mechanism.
- This is applied to **every** real-provider request, not opt-in per incident, and the original,
  unredacted evidence is still what's stored locally and shown in the UI -- only the external
  payload is redacted.
- Only safe, aggregate metadata about redaction (`redactionApplied`, `redactedValueCount`,
  `redactionCategories`) is ever recorded; the removed values themselves are never logged, stored, or
  displayed anywhere.

**Documented limitation, stated plainly:** this is explicitly a **prototype-level safeguard**, not a
production data-loss-prevention system. It targets specific, well-known secret *shapes* by regular
expression -- it does not do named-entity recognition, does not understand semantic context, does not
catch a secret in a format it wasn't written to recognize, and does not catch sensitive information
that doesn't look like a credential at all (an internal server hostname, a customer's real name typed
into a free-text field, an internal project codename). A team deploying something like this for real
incident data would need a genuine DLP/redaction system, human review before external calls for
sensitive incidents, or a policy of only using a self-hosted/private model for such data. This
project does not claim otherwise.

## 5. Protecting private/sensitive data more broadly

Beyond provider-payload redaction specifically:

- API keys are read only on the backend and never bundled into frontend code, logged, or included in
  an error response (`docs/architecture.md`, Section 9).
- There is no authentication/authorization in this prototype -- anyone who can reach the backend can
  read and write any incident. This is a real limitation for handling genuinely sensitive incident
  data and is stated honestly rather than glossed over; a production deployment would need real
  authn/authz, audit logging of who viewed what, and likely per-tenant data isolation.
- Uploaded files are held in memory only for the duration of a request and never written to disk, and
  there is no persistent file storage -- but this also means there is no way to delete a specific
  piece of evidence from a data-retention standpoint short of restarting the process (which discards
  everything, bundled samples and user data alike).
- The bundled sample incidents are entirely synthetic (invented company names, invented services, no
  real user data) specifically so this project never needs to reason about real private information
  during development, testing, or demonstration.

## 6. Who is responsible for a harmful recommendation the AI makes

**The application's position:** the system is designed so that no recommended action or hypothesis
can be acted on without a human decision, and it never presents itself as replacing that decision --
but the responsibility question does not disappear just because software exists to assist.

- Every AI prompt explicitly frames the model as supporting, not replacing, human investigators (see
  the system-prompt openings quoted in `docs/prompts.md`).
- Recommended actions are investigative steps (inspect a metric, compare a configuration, reproduce a
  request pattern) grounded in cited evidence/hypotheses, not autonomous remediation -- nothing in
  this application executes a recommended action automatically; a human always reads, decides, and
  acts.
- If a user acts on a bad AI recommendation without applying their own judgment, that is a failure of
  process around the tool, not something the tool can fully prevent by itself -- the same way a
  monitoring dashboard's bad alert threshold doesn't excuse an engineer from thinking before paging
  the whole team. The honest position is: the tool is built to make it easy to see when a hypothesis
  is unverified, easy to see contradicting evidence, and easy to record a human's own review -- and a
  team choosing to skip all of that is a governance failure the software's design cannot force a fix
  for.

## 7. Supporting, not replacing, human judgment

This is the design principle threaded through every mechanism above and documented in
`docs/architecture.md`, Section 7 ("Human-in-the-loop review points"):

- Facts/assumptions review status, hypothesis status (including the human-only
  `confirmed-by-human`), skeptic-review notes, and postmortem edits are all explicit, separate human
  actions the AI cannot take on its own.
- The skeptic review exists specifically to institutionalize "argue against your own leading
  hypothesis" as a repeatable second pass, rather than relying on an individual engineer to remember
  to do it under pressure.
- The investigation-progress banner tracks concrete review milestones (evidence reviewed, hypotheses
  proposed, risks *and* skeptic review both addressed, a postmortem drafted, the incident resolved)
  as a guide, not a gate -- nothing in the system blocks a user from resolving an incident without
  completing every step, because the tool's job is to make good practice easy, not to enforce it by
  force.
