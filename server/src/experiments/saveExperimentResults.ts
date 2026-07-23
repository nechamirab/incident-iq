import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));

/** `docs/experiments/`, resolved relative to this source file (not `process.cwd()`) so it works regardless of which directory `npm run ai:experiment` is invoked from. */
export const EXPERIMENTS_DOCS_ROOT = join(THIS_DIR, '..', '..', '..', 'docs', 'experiments');

/**
 * Writes one experiment's raw JSON result and human-readable Markdown
 * summary to `docs/experiments/<subdir>/`, overwriting the previous run's
 * `latest.json`/`latest.md` -- this is a repeatable local framework, not an
 * append-only log, so each run replaces the last rather than accumulating
 * files indefinitely. Never called with anything containing an API key or
 * raw provider request/response headers -- callers only ever pass the
 * sanitized `ExperimentCallMetadata`-shaped results this framework produces.
 *
 * @param subdir One of `prompt-comparison`, `provider-comparison`, `prompt-sensitivity`, `skeptic-review`.
 * @param jsonData The raw (already-sanitized) result to serialize as JSON.
 * @param markdown The pre-rendered human-readable summary.
 */
export function saveExperimentResult(subdir: string, jsonData: unknown, markdown: string): { jsonPath: string; markdownPath: string } {
  const dir = join(EXPERIMENTS_DOCS_ROOT, subdir);
  mkdirSync(dir, { recursive: true });

  const jsonPath = join(dir, 'latest.json');
  const markdownPath = join(dir, 'latest.md');

  writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2) + '\n', 'utf-8');
  writeFileSync(markdownPath, markdown, 'utf-8');

  return { jsonPath, markdownPath };
}
