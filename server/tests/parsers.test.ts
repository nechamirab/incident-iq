import { describe, expect, it } from 'vitest';
import { parseCsvContent } from '../src/parsers/csvParser.js';
import { parseJsonContent } from '../src/parsers/jsonParser.js';
import { parseSingleBlock, parseTextContent } from '../src/parsers/textParser.js';
import { parseUploadedFile } from '../src/parsers/index.js';

const INCIDENT_ID = 'incident-1';
const CREATED_AT = '2026-07-01T00:00:00.000Z';

describe('parseTextContent', () => {
  it('creates one evidence item per non-empty line', () => {
    const items = parseTextContent(
      'line one\n\nline two\r\nline three',
      INCIDENT_ID,
      'application-log',
      'Application logs',
      CREATED_AT,
    );

    expect(items).toHaveLength(3);
    expect(items.map((item) => item.originalContent)).toEqual(['line one', 'line two', 'line three']);
  });

  it('preserves original line numbers, skipping blank lines', () => {
    const items = parseTextContent(
      'first\n\nthird',
      INCIDENT_ID,
      'application-log',
      'Application logs',
      CREATED_AT,
    );

    expect(items.map((item) => item.lineNumber)).toEqual([1, 3]);
  });

  it('tags every item with the given incident id, source type, and source name', () => {
    const [item] = parseTextContent(
      'DB timeout',
      INCIDENT_ID,
      'database-error',
      'Database errors',
      CREATED_AT,
    );

    expect(item.incidentId).toBe(INCIDENT_ID);
    expect(item.sourceType).toBe('database-error');
    expect(item.sourceName).toBe('Database errors');
    expect(item.createdAt).toBe(CREATED_AT);
  });

  it('generates unique ids for every line', () => {
    const items = parseTextContent('a\nb\nc', INCIDENT_ID, 'application-log', 'x', CREATED_AT);
    expect(new Set(items.map((item) => item.id)).size).toBe(3);
  });

  it('returns an empty array for blank input', () => {
    expect(parseTextContent('   \n  \n', INCIDENT_ID, 'application-log', 'x', CREATED_AT)).toEqual(
      [],
    );
  });

  it('extracts a leading bracketed ISO timestamp and strips it from the content', () => {
    const [item] = parseTextContent(
      '[2026-06-14T14:28:00Z] Deploy v2.4.1 completed',
      INCIDENT_ID,
      'deployment-note',
      'Deployment notes',
      CREATED_AT,
    );

    expect(item.timestamp).toBe('2026-06-14T14:28:00.000Z');
    expect(item.originalContent).toBe('Deploy v2.4.1 completed');
    expect(item.normalizedContent).toBe('Deploy v2.4.1 completed');
  });

  it('leaves timestamp null and content untouched when a line has no bracket prefix', () => {
    const [item] = parseTextContent('DB timeout', INCIDENT_ID, 'database-error', 'x', CREATED_AT);
    expect(item.timestamp).toBeNull();
    expect(item.originalContent).toBe('DB timeout');
  });

  it('does not treat an unparseable bracketed prefix as a timestamp', () => {
    const [item] = parseTextContent(
      '[not-a-date] something happened',
      INCIDENT_ID,
      'application-log',
      'x',
      CREATED_AT,
    );
    expect(item.timestamp).toBeNull();
    expect(item.originalContent).toBe('[not-a-date] something happened');
  });

  it('extracts a distinct timestamp per line', () => {
    const items = parseTextContent(
      '[2026-06-14T14:28:00Z] first\n[2026-06-14T14:33:00Z] second\nthird (no timestamp)',
      INCIDENT_ID,
      'application-log',
      'x',
      CREATED_AT,
    );

    expect(items.map((item) => item.timestamp)).toEqual([
      '2026-06-14T14:28:00.000Z',
      '2026-06-14T14:33:00.000Z',
      null,
    ]);
    expect(items.map((item) => item.originalContent)).toEqual(['first', 'second', 'third (no timestamp)']);
  });
});

describe('parseSingleBlock', () => {
  it('keeps multi-line prose as a single evidence item', () => {
    const items = parseSingleBlock(
      'Line one of the description.\nLine two of the description.',
      INCIDENT_ID,
      'incident-description',
      'Incident description',
      CREATED_AT,
    );

    expect(items).toHaveLength(1);
    expect(items[0].lineNumber).toBeNull();
    expect(items[0].normalizedContent).toContain('Line two');
  });

  it('extracts a leading bracketed timestamp from a prose block', () => {
    const [item] = parseSingleBlock(
      '[2026-06-14T14:41:00Z] Customers could not complete checkout.',
      INCIDENT_ID,
      'incident-description',
      'Incident description',
      CREATED_AT,
    );

    expect(item.timestamp).toBe('2026-06-14T14:41:00.000Z');
    expect(item.originalContent).toBe('Customers could not complete checkout.');
    expect(item.normalizedContent).toBe('Customers could not complete checkout.');
  });

  it('leaves timestamp null when a prose block has no bracket prefix', () => {
    const [item] = parseSingleBlock(
      'Customers could not complete checkout.',
      INCIDENT_ID,
      'incident-description',
      'x',
      CREATED_AT,
    );
    expect(item.timestamp).toBeNull();
  });

  it('returns an empty array for blank input', () => {
    expect(parseSingleBlock('   ', INCIDENT_ID, 'incident-description', 'x', CREATED_AT)).toEqual(
      [],
    );
  });
});

describe('parseJsonContent', () => {
  it('creates one evidence item per array element', () => {
    const items = parseJsonContent(
      JSON.stringify([{ message: 'a' }, { message: 'b' }, { message: 'c' }]),
      INCIDENT_ID,
      'events.json',
      CREATED_AT,
    );
    expect(items).toHaveLength(3);
    expect(items.every((item) => item.sourceType === 'uploaded-file')).toBe(true);
  });

  it('creates a single evidence item for a top-level object', () => {
    const items = parseJsonContent(
      JSON.stringify({ status: 'ok', count: 5 }),
      INCIDENT_ID,
      'summary.json',
      CREATED_AT,
    );
    expect(items).toHaveLength(1);
    expect(items[0].lineNumber).toBeNull();
  });

  it('extracts a recognizable timestamp field when present', () => {
    const items = parseJsonContent(
      JSON.stringify([{ timestamp: '2026-06-14T14:33:00Z', message: 'error' }]),
      INCIDENT_ID,
      'events.json',
      CREATED_AT,
    );
    expect(items[0].timestamp).toBe('2026-06-14T14:33:00.000Z');
  });

  it('leaves timestamp null when no recognizable field is present', () => {
    const items = parseJsonContent(
      JSON.stringify([{ message: 'no time here' }]),
      INCIDENT_ID,
      'events.json',
      CREATED_AT,
    );
    expect(items[0].timestamp).toBeNull();
  });

  it('throws an ApiError for invalid JSON', () => {
    expect(() => parseJsonContent('{ not valid json', INCIDENT_ID, 'bad.json', CREATED_AT)).toThrow(
      /not valid JSON/,
    );
  });
});

describe('parseCsvContent', () => {
  it('creates one evidence item per data row', () => {
    const csv = 'timestamp,level,message\n2026-06-14T14:33:00Z,ERROR,DB timeout\n2026-06-14T14:34:00Z,WARN,retrying';
    const items = parseCsvContent(csv, INCIDENT_ID, 'events.csv', CREATED_AT);

    expect(items).toHaveLength(2);
    expect(items[0].metadata).toEqual({
      timestamp: '2026-06-14T14:33:00Z',
      level: 'ERROR',
      message: 'DB timeout',
    });
    expect(items[0].lineNumber).toBe(2);
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'message,detail\n"Timeout, retrying",5000ms';
    const items = parseCsvContent(csv, INCIDENT_ID, 'events.csv', CREATED_AT);

    expect(items[0].metadata.message).toBe('Timeout, retrying');
    expect(items[0].metadata.detail).toBe('5000ms');
  });

  it('throws an ApiError for a header-only file with no data rows (no meaningful evidence content)', () => {
    expect(() => parseCsvContent('timestamp,level,message\n', INCIDENT_ID, 'events.csv', CREATED_AT)).toThrow(
      /no CSV data rows/,
    );
  });

  it('throws an ApiError for an empty file', () => {
    expect(() => parseCsvContent('', INCIDENT_ID, 'empty.csv', CREATED_AT)).toThrow(/is empty/);
  });

  it('throws an ApiError for empty (all-blank) column headers', () => {
    const csv = ' , , \n1,2,3';
    expect(() => parseCsvContent(csv, INCIDENT_ID, 'events.csv', CREATED_AT)).toThrow(
      /no meaningful column headers/,
    );
  });

  it('throws an ApiError for duplicate column headers', () => {
    const csv = 'level,level,message\nERROR,WARN,timeout';
    expect(() => parseCsvContent(csv, INCIDENT_ID, 'events.csv', CREATED_AT)).toThrow(
      /duplicate column headers/,
    );
  });

  it('throws an ApiError for a data row with too few columns', () => {
    const csv = 'timestamp,level,message\n2026-06-14T14:33:00Z,ERROR';
    expect(() => parseCsvContent(csv, INCIDENT_ID, 'events.csv', CREATED_AT)).toThrow(/row 2 has 2 column/);
  });

  it('throws an ApiError for a data row with too many columns', () => {
    const csv = 'a,b\n1,2,3';
    expect(() => parseCsvContent(csv, INCIDENT_ID, 'events.csv', CREATED_AT)).toThrow(/row 2 has 3 column/);
  });

  it('treats a completely blank data row (only commas) as empty, not a structural error', () => {
    const csv = 'a,b\n1,2\n , \n3,4';
    const items = parseCsvContent(csv, INCIDENT_ID, 'events.csv', CREATED_AT);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.metadata.a)).toEqual(['1', '3']);
  });

  it('still accepts valid quoted fields containing commas alongside strict column-count validation', () => {
    const csv = 'message,detail\n"Timeout, retrying, again",5000ms';
    const items = parseCsvContent(csv, INCIDENT_ID, 'events.csv', CREATED_AT);
    expect(items).toHaveLength(1);
    expect(items[0].metadata.message).toBe('Timeout, retrying, again');
  });
});

describe('parseUploadedFile: empty .txt/.log rejection', () => {
  it('throws an ApiError for an empty .txt upload', () => {
    expect(() =>
      parseUploadedFile({ originalName: 'notes.txt', buffer: Buffer.from('') }, INCIDENT_ID, CREATED_AT),
    ).toThrow(/is empty/);
  });

  it('throws an ApiError for a whitespace-only .log upload', () => {
    expect(() =>
      parseUploadedFile(
        { originalName: 'app.log', buffer: Buffer.from('   \n  \n\t') },
        INCIDENT_ID,
        CREATED_AT,
      ),
    ).toThrow(/is empty/);
  });
});

describe('parseUploadedFile', () => {
  it('dispatches .txt and .log files to the text parser', () => {
    const items = parseUploadedFile(
      { originalName: 'notes.txt', buffer: Buffer.from('line one\nline two') },
      INCIDENT_ID,
      CREATED_AT,
    );
    expect(items).toHaveLength(2);
    expect(items[0].sourceType).toBe('uploaded-file');
  });

  it('dispatches .json files to the JSON parser', () => {
    const items = parseUploadedFile(
      { originalName: 'events.json', buffer: Buffer.from(JSON.stringify([{ a: 1 }, { a: 2 }])) },
      INCIDENT_ID,
      CREATED_AT,
    );
    expect(items).toHaveLength(2);
  });

  it('dispatches .csv files to the CSV parser', () => {
    const items = parseUploadedFile(
      { originalName: 'events.csv', buffer: Buffer.from('a,b\n1,2') },
      INCIDENT_ID,
      CREATED_AT,
    );
    expect(items).toHaveLength(1);
  });

  it('throws for an unsupported extension', () => {
    expect(() =>
      parseUploadedFile(
        { originalName: 'malware.exe', buffer: Buffer.from('x') },
        INCIDENT_ID,
        CREATED_AT,
      ),
    ).toThrow(/unsupported file type/i);
  });
});
