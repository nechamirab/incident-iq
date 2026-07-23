import type { Incident } from '../../../../shared/types/incident.js';
import type { AiTimelineEvent } from '../schemas/aiAnalysisResponse.schema.js';

/** How far before `startedAt`/`detectedAt` a timeline event may reasonably fall before being flagged -- generous on purpose, since legitimate deployment or historical context can genuinely predate an incident by days. */
const PLAUSIBLE_WINDOW_BEFORE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** How far after `detectedAt` an event may fall before being flagged -- generous to tolerate clock skew and an incident that is still ongoing. */
const PLAUSIBLE_WINDOW_AFTER_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Produces non-blocking plausibility warnings for a set of AI-generated
 * timeline events -- never rejects or mutates them. This is a semantic
 * check layered on top of schema validation: the AI-facing timeline
 * schema only requires `timestamp` to be *a string*, so a garbage or
 * wildly-out-of-range value would otherwise pass through silently. Every
 * check here is deliberately generous (a wide window around the incident,
 * only exact contradictions flagged) so that legitimate pre-incident
 * deployment or historical evidence is never treated as automatically
 * invalid -- see the audit finding this addresses (M27 in
 * `docs/requirements-compliance-audit.md`).
 *
 * @param events The AI response's `timeline` array.
 * @param incident The incident being analyzed, for its known time window.
 * @returns Human-readable warning strings, one per implausibility found (empty if none).
 */
export function validateTimelinePlausibility(
  events: readonly AiTimelineEvent[],
  incident: Pick<Incident, 'startedAt' | 'detectedAt'>,
): string[] {
  const warnings: string[] = [];
  const now = Date.now();
  const detectedAtMs = Date.parse(incident.detectedAt);
  const windowStartMs = incident.startedAt
    ? Date.parse(incident.startedAt) - PLAUSIBLE_WINDOW_BEFORE_MS
    : (Number.isNaN(detectedAtMs) ? -Infinity : detectedAtMs - PLAUSIBLE_WINDOW_BEFORE_MS);
  const windowEndMs = Number.isNaN(detectedAtMs) ? Infinity : detectedAtMs + PLAUSIBLE_WINDOW_AFTER_MS;

  events.forEach((event, index) => {
    const label = `Timeline event #${index + 1} ("${event.title}")`;
    const eventMs = Date.parse(event.timestamp);

    if (Number.isNaN(eventMs)) {
      warnings.push(`${label} has an unparseable timestamp ("${event.timestamp}") and cannot be placed on the timeline.`);
      return;
    }

    if (eventMs > now) {
      warnings.push(`${label} is timestamped in the future (${event.timestamp}), which is not possible.`);
    }

    if (eventMs < windowStartMs || eventMs > windowEndMs) {
      warnings.push(
        `${label} is timestamped far outside this incident's known window (${event.timestamp}) -- ` +
          'confirm this is genuinely related context, not an unrelated or invented event.',
      );
    }

    if (event.timestampType === 'exact' && event.isInferred) {
      warnings.push(
        `${label} is marked timestampType "exact" but isInferred is true -- an inferred timestamp ` +
          'must not be presented with exact-level certainty.',
      );
    }

    if (event.timestampType === 'inferred' && !event.isInferred) {
      warnings.push(
        `${label} is marked timestampType "inferred" but isInferred is false -- these should agree.`,
      );
    }
  });

  return warnings;
}
