import { describe, expect, it } from 'vitest';

import { formatStockDocumentCountInput } from './document-count-input';

describe('stock document quantity formatting', () => {
  it.each([
    ['3.000', '3'],
    ['0.500', '0.5'],
    ['1.230', '1.23'],
    ['0.000', '0'],
  ])(
    'formats initialized and blurred quantities: %s -> %s',
    (value, expected) => {
      expect(formatStockDocumentCountInput(value)).toBe(expected);
    },
  );

  it('preserves decimal text while the user is typing', () => {
    expect(
      formatStockDocumentCountInput(0, {
        input: '0.',
        userTyping: true,
      }),
    ).toBe('0.');
    expect(
      formatStockDocumentCountInput(0.5, {
        input: '0.500',
        userTyping: true,
      }),
    ).toBe('0.500');
  });

  it('keeps an empty input empty', () => {
    expect(formatStockDocumentCountInput(null)).toBe('');
    expect(formatStockDocumentCountInput(undefined)).toBe('');
    expect(formatStockDocumentCountInput('')).toBe('');
  });
});
