# Experiment A: Prompt Comparison (v1 vs. v2)

Incident: `sample-db-connection-leak`

## Mock pipeline check (always runs; not a real comparison)

MockAIProvider is deterministic and derives its response entirely from the incident's evidence, ignoring the prompt text (by design -- see MockAIProvider.complete). Running v1 and v2 through the mock provider therefore only confirms that both prompt versions still produce a schema-valid, well-formed AnalysisRun through the shared validation pipeline; it demonstrates nothing about how v1 and v2 actually differ. That comparison requires a real provider -- see "realComparison" below.

- v1 mock run: 4 hypotheses, 4 reasoning risks.
- v2 mock run: 4 hypotheses, 4 reasoning risks.

## Real-provider comparison

**NOT RUN.** No real provider was configured for this experiment run.
