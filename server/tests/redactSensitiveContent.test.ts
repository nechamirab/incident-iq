import { describe, expect, it } from 'vitest';
import { redactPromptForExternalProvider, redactSensitiveContent } from '../src/ai/redactSensitiveContent.js';

describe('redactSensitiveContent', () => {
  it('redacts an email address', () => {
    const result = redactSensitiveContent('Contact: jane.doe@example.com about this.');
    expect(result.redactedText).toContain('[REDACTED_EMAIL]');
    expect(result.redactedText).not.toContain('jane.doe@example.com');
    expect(result.redactionCategories).toContain('email');
  });

  it('redacts a Bearer token', () => {
    const result = redactSensitiveContent('curl -H "Authorization: Bearer abcDEF123456789xyz"');
    expect(result.redactedText).not.toContain('abcDEF123456789xyz');
    expect(result.redactionCategories).toContain('authorization-header');
  });

  it('redacts a standalone Authorization header line', () => {
    const result = redactSensitiveContent('Authorization: Basic dXNlcjpwYXNz');
    expect(result.redactedText).not.toContain('dXNlcjpwYXNz');
    expect(result.redactionCategories).toContain('authorization-header');
  });

  it('redacts a well-known API key prefix', () => {
    const result = redactSensitiveContent('OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwx');
    expect(result.redactedText).toContain('[REDACTED_TOKEN]');
    expect(result.redactedText).not.toContain('sk-abcdefghijklmnopqrstuvwx');
    expect(result.redactionCategories).toContain('api-key');
  });

  it('redacts a password key/value pair', () => {
    const result = redactSensitiveContent('config: password=SuperSecret123');
    expect(result.redactedText).toContain('[REDACTED_SECRET]');
    expect(result.redactedText).not.toContain('SuperSecret123');
    expect(result.redactionCategories).toContain('password');
  });

  it('redacts a generic secret key/value pair', () => {
    const result = redactSensitiveContent('client_secret: "abcd1234efgh5678"');
    expect(result.redactedText).not.toContain('abcd1234efgh5678');
    expect(result.redactionCategories).toContain('secret-value');
  });

  it('redacts an access token key/value pair', () => {
    const result = redactSensitiveContent('access_token=ya29.a0AfH6SMBxyz123456');
    expect(result.redactedText).not.toContain('ya29.a0AfH6SMBxyz123456');
    expect(result.redactionCategories).toContain('access-token');
  });

  it('redacts a refresh token key/value pair', () => {
    const result = redactSensitiveContent('refresh_token: 1//0gAbCdEfGhIjKl');
    expect(result.redactedText).not.toContain('1//0gAbCdEfGhIjKl');
    expect(result.redactionCategories).toContain('refresh-token');
  });

  it('redacts a session id', () => {
    const result = redactSensitiveContent('session_id=abc123def456ghi789');
    expect(result.redactedText).toContain('[REDACTED_SESSION]');
    expect(result.redactedText).not.toContain('abc123def456ghi789');
    expect(result.redactionCategories).toContain('session-id');
  });

  it('redacts a Cookie header', () => {
    const result = redactSensitiveContent('Cookie: sessionid=xyz789; other=value');
    expect(result.redactedText).not.toContain('sessionid=xyz789');
    expect(result.redactionCategories).toContain('cookie');
  });

  it('redacts a credit-card-shaped number run', () => {
    const result = redactSensitiveContent('Card on file: 4111 1111 1111 1111');
    expect(result.redactedText).toContain('[REDACTED_PAYMENT_VALUE]');
    expect(result.redactedText).not.toContain('4111 1111 1111 1111');
    expect(result.redactionCategories).toContain('payment-value');
  });

  it('does not flag ordinary timestamps', () => {
    const result = redactSensitiveContent('Event occurred at 2026-06-14T14:33:00Z, 47 failures logged.');
    expect(result.redactionApplied).toBe(false);
    expect(result.redactedText).toBe('Event occurred at 2026-06-14T14:33:00Z, 47 failures logged.');
  });

  it('does not flag a typical evidence id', () => {
    const text = '[sample-payment-gateway-timeout-ev-11] (api-error, ...): 512 failures between 15:42 and 16:04 UTC.';
    const result = redactSensitiveContent(text);
    expect(result.redactedText).toBe(text);
    expect(result.redactionApplied).toBe(false);
  });

  it('does not flag harmless numbers (HTTP status codes, ports, counts)', () => {
    const text = 'HTTP 500 error on port 8443, count 47, threshold 0.5.';
    const result = redactSensitiveContent(text);
    expect(result.redactedText).toBe(text);
  });

  it('does not flag ordinary log codes/ids', () => {
    const text = 'orders-db connection-pool alert ALRT-2026-0614-001 fired.';
    const result = redactSensitiveContent(text);
    expect(result.redactedText).toBe(text);
  });

  it('reports zero redactions and redactionApplied=false for clean text', () => {
    const result = redactSensitiveContent('checkout-api returned 500 errors starting at 14:33 UTC.');
    expect(result.redactionApplied).toBe(false);
    expect(result.redactedValueCount).toBe(0);
    expect(result.redactionCategories).toEqual([]);
  });

  it('counts multiple redactions across categories in one string', () => {
    const result = redactSensitiveContent(
      'user jane@example.com logged in; password=hunter22xx; card 4111 1111 1111 1111',
    );
    expect(result.redactedValueCount).toBeGreaterThanOrEqual(3);
    expect(result.redactionCategories.length).toBeGreaterThanOrEqual(3);
  });

  it('never returns the original secret value anywhere in the result object', () => {
    const secret = 'sk-superSecretApiKey1234567890';
    const result = redactSensitiveContent(`key=${secret}`);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secret);
  });

  it('does not mutate its input string (strings are immutable, but confirms no shared-reference surprises)', () => {
    const input = 'password=hunter2222';
    const result = redactSensitiveContent(input);
    expect(input).toBe('password=hunter2222');
    expect(result.redactedText).not.toBe(input);
  });
});

describe('redactPromptForExternalProvider', () => {
  it('redacts both system and user portions independently', () => {
    const result = redactPromptForExternalProvider({
      system: 'System note: OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwx',
      user: 'Evidence: user reported jane@example.com could not log in.',
    });

    expect(result.redactedPrompt.system).not.toContain('sk-abcdefghijklmnopqrstuvwx');
    expect(result.redactedPrompt.user).not.toContain('jane@example.com');
    expect(result.redactionApplied).toBe(true);
    expect(result.redactedValueCount).toBe(2);
    expect(result.redactionCategories.sort()).toEqual(['api-key', 'email'].sort());
  });

  it('returns a new prompt object, never mutating the one passed in', () => {
    const original = { system: 'password=hunter2222', user: 'clean text' };
    const result = redactPromptForExternalProvider(original);

    expect(original.system).toBe('password=hunter2222');
    expect(result.redactedPrompt).not.toBe(original);
  });

  it('reports redactionApplied=false and empty categories for a clean prompt', () => {
    const result = redactPromptForExternalProvider({
      system: 'You are an incident-investigation assistant.',
      user: 'Evidence: checkout-api returned 500 errors at 14:33 UTC.',
    });
    expect(result.redactionApplied).toBe(false);
    expect(result.redactedValueCount).toBe(0);
    expect(result.redactionCategories).toEqual([]);
  });
});
