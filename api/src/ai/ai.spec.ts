import { vi } from 'vitest';
import { AiService, redact } from './ai.js';

const reply = (content: unknown, ok = true) => ({ ok, json: async () => ({ choices: [{ message: { content } }] }) }) as Response;

describe('redact', () => {
  it('replaces every term, case-insensitively and literally', () => {
    expect(redact('I met ACME corp and Bob at acme.', ['Acme', 'bob'])).toBe('I met [redacted] corp and [redacted] at [redacted].');
    expect(redact('cost (a+b) is $5', ['(a+b)', '$5'])).toBe('cost [redacted] is [redacted]');
  });

  it('prefers the longest term', () => {
    expect(redact('Acme Corp rocks', ['Acme', 'Acme Corp'])).toBe('[redacted] rocks');
  });

  it('ignores blank terms, so nothing is redacted by accident', () => {
    expect(redact('hello world', ['', '  '])).toBe('hello world');
    expect(redact('hello world', [])).toBe('hello world');
  });
});

describe('AiService.refine', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.OPENROUTER_MODELS = ' model-a, ,model-b ';
  });
  afterEach(() => vi.unstubAllGlobals());

  const modelsTried = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).model);

  it('falls through a failing model to the next', async () => {
    fetchMock.mockResolvedValueOnce(reply('', false)).mockResolvedValueOnce(reply('  better text '));
    expect(await new AiService().refine('text')).toBe('better text');
    expect(modelsTried()).toEqual(['model-a', 'model-b']);
  });

  it('moves on after an empty reply or a thrown error', async () => {
    fetchMock.mockResolvedValueOnce(reply('   ')).mockRejectedValueOnce(new Error('network'));
    expect(await new AiService().refine('text')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when no model is configured', async () => {
    process.env.OPENROUTER_MODELS = '';
    expect(await new AiService().refine('text')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
