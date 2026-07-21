import { randomUUID } from 'node:crypto';

/**
 * Generates a unique, prefixed identifier (e.g. `incident-3f1c...`).
 * The prefix makes ids self-describing in logs and API responses.
 *
 * @param prefix Short label identifying the entity type.
 * @returns A unique id string.
 */
export function createId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
