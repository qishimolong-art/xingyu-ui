import { describe, expect, it } from 'vitest';

import { formatPurchaseInCountInput } from './purchase-in-count-input';

describe('purchase in conversion quantity formatting', () => {
  it.each([
    ['1.000', '1'],
    ['1.250', '1.25'],
    ['0.123456', '0.123456'],
    ['0.000', '0'],
    ['-2.500', '-2.5'],
  ])(
    'formats initialized and blurred quantities: %s -> %s',
    (value, expected) => {
      expect(formatPurchaseInCountInput(value)).toBe(expected);
    },
  );

  it('preserves decimal text while the user is typing', () => {
    expect(
      formatPurchaseInCountInput(1, {
        input: '1.',
        userTyping: true,
      }),
    ).toBe('1.');
    expect(
      formatPurchaseInCountInput(1.2, {
        input: '1.20',
        userTyping: true,
      }),
    ).toBe('1.20');
  });

  it('keeps an empty input empty', () => {
    expect(formatPurchaseInCountInput(null)).toBe('');
    expect(formatPurchaseInCountInput(undefined)).toBe('');
    expect(formatPurchaseInCountInput('')).toBe('');
  });
});
