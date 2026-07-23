# Experiment C: Prompt Sensitivity (standard vs. "argue against first apparent cause")

Incident: `sample-db-connection-leak`

## Mock pipeline check (always runs; not a real comparison)

MockAIProvider ignores prompt text entirely (see MockAIProvider.complete), so it cannot meaningfully demonstrate prompt sensitivity. This leg only confirms the "argue against the first apparent cause" variant still produces a schema-valid AnalysisRun through the shared validation pipeline. The actual sensitivity comparison requires a real provider -- see "realComparison" below.

## Real-provider comparison

**NOT RUN.** No real provider was configured for this experiment run.
