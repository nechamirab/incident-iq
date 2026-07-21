import { z } from 'zod';

/** Non-empty identifier used for every domain entity. */
export const IdSchema = z.string().min(1, 'id must not be empty');

/** ISO-8601 timestamp string (e.g. `2026-06-14T14:32:00Z`). */
export const IsoDateTimeSchema = z.iso.datetime({ message: 'must be an ISO-8601 timestamp' });

/**
 * Investigation confidence score. Always an integer 0-100, treated as an
 * investigation aid rather than a statistically precise probability.
 */
export const ConfidenceScoreSchema = z
  .number()
  .int()
  .min(0, 'confidence must be at least 0')
  .max(100, 'confidence must be at most 100');

/** Free-form evidence metadata (e.g. file name, MIME type, HTTP status). */
export const MetadataSchema = z.record(z.string(), z.unknown());
