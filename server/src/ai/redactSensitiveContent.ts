import type { AIPrompt } from './providers/AIProvider.js';

/**
 * Result of redacting one piece of text. Deliberately carries only counts
 * and category names, never the redacted values themselves -- satisfying
 * "never store the removed secret values" even in memory, let alone in
 * anything persisted or logged.
 */
export interface RedactionResult {
  redactedText: string;
  redactionApplied: boolean;
  redactedValueCount: number;
  redactionCategories: string[];
}

interface RedactionRule {
  category: string;
  pattern: RegExp;
  replacement: string | ((match: string) => string);
}

/**
 * Prototype-level redaction rules, deliberately conservative: each pattern
 * targets a specific, well-known secret *shape* (a labeled key/value pair,
 * a well-known token prefix, a long digit run shaped like a card number)
 * rather than "any long alphanumeric string" -- a broad catch-all would
 * also redact this app's own evidence ids (e.g.
 * `sample-payment-gateway-timeout-ev-11`, itself well over 32 characters)
 * and break the model's ability to cite them. This is explicitly a
 * prototype-level safeguard against the most common accidental leaks, not
 * a production-grade data-loss-prevention system -- see
 * `docs/ethical-and-professional-risks.md` for the documented limitation.
 */
const REDACTION_RULES: readonly RedactionRule[] = [
  {
    category: 'authorization-header',
    pattern: /\bauthorization\s*:\s*\S+(?:\s+\S+)?/gi,
    replacement: 'Authorization: [REDACTED_TOKEN]',
  },
  {
    category: 'bearer-token',
    pattern: /\bBearer\s+[a-zA-Z0-9\-_.=]{8,}/g,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  {
    category: 'cookie',
    pattern: /\b(?:set-)?cookie\s*:\s*[^\n\r]+/gi,
    replacement: (m: string) => `${m.slice(0, m.indexOf(':') + 1)} [REDACTED_SESSION]`,
  },
  {
    category: 'api-key',
    // Well-known real-world API key prefixes (OpenAI, Stripe, AWS, GitHub, Slack, generic sk-/pk-).
    pattern: /\b(?:sk|pk)-[a-zA-Z0-9]{16,}\b|\bAKIA[0-9A-Z]{12,}\b|\bghp_[a-zA-Z0-9]{16,}\b|\bxox[baprs]-[a-zA-Z0-9-]{10,}\b/g,
    replacement: '[REDACTED_TOKEN]',
  },
  {
    category: 'password',
    pattern: /\b(password|passwd|pwd)\s*[:=]\s*['"]?[^\s'",;]{3,}['"]?/gi,
    replacement: (m: string) => `${m.slice(0, m.search(/[:=]/) + 1)} [REDACTED_SECRET]`,
  },
  {
    category: 'secret-value',
    pattern: /\b(secret|client[_-]?secret|api[_-]?key|apikey)\s*[:=]\s*['"]?[^\s'",;]{4,}['"]?/gi,
    replacement: (m: string) => `${m.slice(0, m.search(/[:=]/) + 1)} [REDACTED_SECRET]`,
  },
  {
    category: 'access-token',
    pattern: /\baccess[_-]?token\s*[:=]\s*['"]?[^\s'",;]{4,}['"]?/gi,
    replacement: (m: string) => `${m.slice(0, m.search(/[:=]/) + 1)} [REDACTED_TOKEN]`,
  },
  {
    category: 'refresh-token',
    pattern: /\brefresh[_-]?token\s*[:=]\s*['"]?[^\s'",;]{4,}['"]?/gi,
    replacement: (m: string) => `${m.slice(0, m.search(/[:=]/) + 1)} [REDACTED_TOKEN]`,
  },
  {
    category: 'session-id',
    pattern: /\bsession[_-]?id\s*[:=]\s*['"]?[a-zA-Z0-9\-_.]{6,}['"]?/gi,
    replacement: (m: string) => `${m.slice(0, m.search(/[:=]/) + 1)} [REDACTED_SESSION]`,
  },
  {
    category: 'email',
    pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    category: 'payment-value',
    // A run of 13-19 digits, optionally grouped in 4s by spaces or dashes --
    // the shape of a card number. Deliberately NOT applied to shorter runs
    // (HTTP status codes, ports, small counters) or to hyphenated ids like
    // evidence ids, which are not purely digit groups of this length.
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    replacement: '[REDACTED_PAYMENT_VALUE]',
  },
];

/**
 * Redacts common categories of sensitive content (see {@link REDACTION_RULES})
 * from a single string. Pure and side-effect-free: never logs, never
 * mutates its input, never returns the matched values.
 *
 * @param text The text to scan (never mutated).
 */
export function redactSensitiveContent(text: string): RedactionResult {
  let redactedText = text;
  let redactedValueCount = 0;
  const categoriesFound = new Set<string>();

  for (const rule of REDACTION_RULES) {
    const matches = redactedText.match(rule.pattern);
    if (matches && matches.length > 0) {
      redactedValueCount += matches.length;
      categoriesFound.add(rule.category);
      redactedText =
        typeof rule.replacement === 'string'
          ? redactedText.replace(rule.pattern, rule.replacement)
          : redactedText.replace(rule.pattern, rule.replacement);
    }
  }

  return {
    redactedText,
    redactionApplied: redactedValueCount > 0,
    redactedValueCount,
    redactionCategories: Array.from(categoriesFound),
  };
}

/** Combined redaction outcome for both halves of an {@link AIPrompt}. */
export interface PromptRedactionResult {
  redactedPrompt: AIPrompt;
  redactionApplied: boolean;
  redactedValueCount: number;
  redactionCategories: string[];
}

/**
 * Redacts both the system and user portions of a prompt -- the exact
 * payload a real provider is about to send externally. Returns a brand
 * new `AIPrompt` object; the one passed in is never mutated, and nothing
 * upstream (the incident's stored evidence, the original prompt object
 * built once per request and also used by the mock provider) is ever
 * touched. Call this only from a *real* provider's `complete()`,
 * immediately before constructing the SDK request -- never from
 * `MockAIProvider`, which may use the original synthetic evidence as-is
 * since it never leaves the process.
 *
 * @param prompt The original, unredacted prompt.
 */
export function redactPromptForExternalProvider(prompt: AIPrompt): PromptRedactionResult {
  const system = redactSensitiveContent(prompt.system);
  const user = redactSensitiveContent(prompt.user);

  return {
    redactedPrompt: { system: system.redactedText, user: user.redactedText },
    redactionApplied: system.redactionApplied || user.redactionApplied,
    redactedValueCount: system.redactedValueCount + user.redactedValueCount,
    redactionCategories: Array.from(new Set([...system.redactionCategories, ...user.redactionCategories])),
  };
}
