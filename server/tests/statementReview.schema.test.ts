import { describe, expect, it } from 'vitest';
import { StatementReviewRequestSchema } from '../src/schemas/statementReview.schema.js';

describe('StatementReviewRequestSchema', () => {
  it.each(['unreviewed', 'supported', 'partially-supported', 'unsupported', 'rejected'])(
    'accepts reviewStatus "%s"',
    (reviewStatus) => {
      expect(StatementReviewRequestSchema.safeParse({ reviewStatus }).success).toBe(true);
    },
  );

  it('rejects an invalid reviewStatus', () => {
    expect(StatementReviewRequestSchema.safeParse({ reviewStatus: 'confirmed' }).success).toBe(false);
  });

  it('rejects a missing reviewStatus', () => {
    expect(StatementReviewRequestSchema.safeParse({}).success).toBe(false);
  });
});
