import { expect, it } from 'vitest';
import { GENERATED_ERROR_MESSAGES } from '../api/error-codes.generated.ts';
import {
  NEUTRAL_MESSAGE,
  normalizeMessage,
  selectMessages,
} from './error-messages.mjs';

const route = (listed, texts = {}) => ({ listed, texts });

it('keeps a text that every route documents identically', () => {
  const { messages, kept } = selectMessages([
    route(['A'], { A: ['The pack was not found'] }),
    route(['A'], { A: ['  The pack   was not found.  '] }),
  ]);
  expect(messages.get('A')).toBe('The pack was not found.');
  expect(kept.has('A')).toBe(true);
});

it('keeps the text of a code that exactly one route lists', () => {
  const { messages } = selectMessages([
    route(['A'], { A: ['the state could not be read'] }),
    route(['B'], { B: ['Other'] }),
  ]);
  expect(messages.get('A')).toBe('The state could not be read.');
});

it('uses a neutral message when routes document different texts', () => {
  const { messages, kept } = selectMessages([
    route(['A'], { A: ['Larger than 12 KB'] }),
    route(['A'], { A: ['Larger than 16 KB'] }),
  ]);
  expect(messages.get('A')).toBe(NEUTRAL_MESSAGE);
  expect(kept.has('A')).toBe(false);
});

it('uses a neutral message for a code that a response example shows elsewhere', () => {
  const { messages, kept } = selectMessages(
    [route(['A'], { A: ['Only one route lists this'] })],
    new Set(['A']),
  );
  expect(messages.get('A')).toBe(NEUTRAL_MESSAGE);
  expect(kept.has('A')).toBe(false);
});

it('uses a neutral message when only some routes document the code', () => {
  const { messages } = selectMessages([
    route(['A'], { A: ['Documented here'] }),
    route(['A']),
  ]);
  expect(messages.get('A')).toBe(NEUTRAL_MESSAGE);
});

it('never takes a response description as the message', () => {
  const { messages } = selectMessages([route(['A'], {}), route(['A'], {})]);
  expect(messages.has('A')).toBe(false);
});

it('normalises a text into one sentence', () => {
  expect(normalizeMessage('- first line\nsecond line')).toBe(
    'First line second line.',
  );
  expect(normalizeMessage('Already done!')).toBe('Already done!');
  expect(normalizeMessage('   ')).toBe('');
});

it('keeps every committed message a single plain sentence', () => {
  for (const [code, message] of Object.entries(GENERATED_ERROR_MESSAGES)) {
    expect(message, code).toMatch(/^[A-Z]/);
    expect(message, code).toMatch(/[.!?]$/);
    expect(message, code).not.toMatch(/\n/);
    expect(message, code).not.toMatch(/^- /);
    expect(message, code).not.toContain('- `');
  }
});
