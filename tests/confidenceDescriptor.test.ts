import { describe, expect, it } from 'vitest';
import { getConfidenceDescriptor } from '../src/utils/confidenceDescriptor';

describe('getConfidenceDescriptor', () => {
  it('labels low confidence below 40', () => {
    expect(getConfidenceDescriptor(0)).toBe('Low confidence');
    expect(getConfidenceDescriptor(39)).toBe('Low confidence');
  });

  it('labels moderate confidence between 40 and 69', () => {
    expect(getConfidenceDescriptor(40)).toBe('Moderate confidence');
    expect(getConfidenceDescriptor(69)).toBe('Moderate confidence');
  });

  it('labels high confidence at 70 and above', () => {
    expect(getConfidenceDescriptor(70)).toBe('High confidence');
    expect(getConfidenceDescriptor(100)).toBe('High confidence');
  });
});
