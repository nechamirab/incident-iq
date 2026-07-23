# Demo Script

**Status: this is a script for a demo video that has not yet been recorded.** No video exists yet;
this document describes the intended walkthrough so the recording can be done efficiently in one
take. See the project README and `docs/reflective-report.md` for the (also placeholder) video link.

Total target length: **6-8 minutes**. Uses the bundled `mock` AI provider (`AI_PROVIDER=mock`, the
default) so the demo is fully reproducible and needs no API key -- if demonstrating with a real
provider instead, note the timing/output differences called out below.

## Setup (before recording)

1. `cp .env.example .env` if not already done; leave `AI_PROVIDER=mock` (or set it explicitly).
2. `npm install`, then `npm run dev` (starts frontend on `:5173` and backend on `:4001`).
3. Confirm `http://localhost:4001/api/health` responds and the Dashboard's connection-status card
   shows connected.

## Segment 1 -- Dashboard and creating an incident (~60s)

- Open the Dashboard (`/`). **Explain:** this lists every incident (bundled samples plus anything
  created this session), with a status summary row and search/filter controls.
- Click "Start a new incident." **Explain:** the New Incident form has seven category-specific
  evidence fields (application logs, error traces, monitoring alerts, deployment notes, user
  complaints, API errors, database errors) plus file upload for `.txt`/`.log`/`.json`/`.csv`.
- Click "Load sample incident" and pick **`sample-ecommerce-checkout`** (checkout failures after a
  deploy that reduced a DB connection pool -- deliberately ambiguous, with real red herrings). **Say
  out loud** that this is a bundled synthetic scenario, not real production data.
- Click "Save & analyze incident." **Explain while it runs:** this creates the incident and triggers
  the first AI analysis pass in one step.

## Segment 2 -- Overview and Facts vs. Assumptions (~90s)

- Land on the incident workspace, **Overview** tab. **Point out:** the AI-generated summary, impact
  statement, affected components, and the **uncertainty statement** -- explain this is a mandatory
  field the model must fill in, distinct from confidence scores on individual hypotheses.
- Point out the provenance chips: **provider, model, prompt version, timestamp, duration**. **Say:**
  "this is how you can always tell whether a given result came from the mock provider or a real one,
  and exactly which prompt version produced it."
- Switch to **Facts & Assumptions**. **Explain the three-way split:** facts (each citing at least one
  real evidence id), assumptions (plausible but explicitly unproven), and unsupported claims (a
  demotion path for anything the AI stated as a fact that turned out not to actually cite valid
  evidence -- explain this is a real validation mechanism, not just labeling). Click a fact's
  evidence-id chip to show it jumps straight to the Evidence tab.

## Segment 3 -- Hypotheses, contradicting evidence, and human review (~90s)

- Switch to **Hypotheses**. **Point out:** each hypothesis shows confidence as a bar, a number, and a
  text label together (never color alone), supporting evidence, and a **separate, explicit**
  contradicting-evidence group -- explain that an empty contradicting list is shown as an honest "none
  found" rather than hidden.
- **Demonstrate human hypothesis review:** open a hypothesis's status control, show the options
  (Testing / Supported / Weakened / Reject / Confirm as Human-Verified). Select "Confirm as
  Human-Verified." **Explain:** this opens a dialog requiring an explicit confirmation and an
  optional note -- say plainly that the AI can never set this status itself; only this explicit human
  action can, and the backend enforces that, not just the UI.

## Segment 4 -- Reasoning Risks (~60s)

- Switch to **Reasoning Risks**. **Explain:** these are the specific biases/fallacies the analysis
  flagged about *itself*, not a generic checklist -- point out that with the mock provider you'll
  typically see automation-bias (an honest self-disclosure that this is mock output), plus others
  depending on the incident's actual evidence (e.g. post-hoc-fallacy if a deployment is present,
  anchoring-bias if evidence predates the incident start). **If demonstrating with a real provider
  instead of mock**, be prepared to show and honestly narrate that reasoning risks may come back
  empty -- this is a documented, real finding (see `docs/bias-and-fallacy-analysis.md`), not a demo
  bug.

## Segment 5 -- Skeptic Review (~90s)

- Switch to **AI Review**. **Explain:** this is a second, independent AI pass that specifically
  challenges the leading (highest-confidence) hypothesis -- never simply restates the original
  analysis.
- Click "Run skeptic review." Once it completes, walk through its fields: **challenge summary,
  alternative explanations, confirmation-bias assessment, falsification test, recommended tests,
  overall assessment.** Point out it never overwrites the original analysis run -- it's a new,
  separate record.
- Add a note in the reviewer-notes field and save it. **Explain:** this is stored separately from the
  AI-generated content, never mixed with it.

## Segment 6 -- Postmortem generation and export (~60s)

- Switch to **Postmortem**. Click "Generate postmortem draft." **Explain:** unlike the analysis run
  and skeptic review (both append-only records), a postmortem is a single evolving document -- every
  field becomes directly editable in place.
- Edit one field (e.g. add a sentence to "Lessons Learned"), click "Save changes." **Explain:** this
  merges the edit and only updates `lastEditedAt`; regenerating instead would fully discard edits (a
  deliberately different, clearly-labeled destructive action).
- Click "Download as Markdown" (or "Copy"). **Explain:** this works entirely from the in-browser
  draft, no server round-trip needed for export.

## Segment 7 -- Wrap-up (~30s)

- Return to the Dashboard, point out the incident just created now appears at the top, and its status
  summary/filters already reflect it.
- **Closing statement (say explicitly, do not skip):** "IncidentIQ never lets the AI mark something as
  human-confirmed, always separates facts from assumptions, always shows its own uncertainty, and
  keeps a human in the loop at every consequential decision point -- that's the core design principle
  behind everything just shown."

## Optional extension (if time allows): mock vs. real provider

If a real `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` is available and the presenter chooses to demonstrate
it: restart the backend with `AI_PROVIDER=openai` (or `anthropic`), re-run analysis on the same
incident, and directly compare the provenance chip (`provider: "openai"` instead of `"mock"`) and the
reasoning-risks/contradicting-evidence output against the mock run just shown -- an honest live
demonstration of the real gaps documented in `docs/bias-and-fallacy-analysis.md` and
`docs/requirements-compliance-audit.md`, rather than a claim that real output is always richer than
mock output.

## What NOT to do while recording

- Do not claim any AI output is a "confirmed root cause."
- Do not skip the human-hypothesis-confirmation dialog's explicit confirmation step.
- Do not present mock output as if it came from a real provider, or vice versa -- always read the
  provenance chip out loud when it's relevant to the point being made.
- Do not use real, non-synthetic incident data.
