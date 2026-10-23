import { describe, expect, it } from 'vitest';

import { formatPurchaseInvoiceCountInput } from './purchase-invoice-item-number';

describe('purchase invoice item number formatting', () => {
  it.each([
    ['1.000', '1'],
    ['1.250', '1.25'],
    ['0.123456', '0.123456'],
    ['0.000', '0'],
    ['-2.500', '-2.5'],
  ])('formats initialized and blurred counts: %s -> %s', (value, expected) => {
    expect(formatPurchaseInvoiceCountInput(value)).toBe(expected);
  });

  it('preserves decimal text while the user is typing', () => {
    expect(
      formatPurchaseInvoiceCountInput(1, {
        input: '1.',
        userTyping: true,
      }),
    ).toBe('1.');
    expect(
      formatPurchaseInvoiceCountInput(1.2, {
        input: '1.20',
        userTyping: true,
      }),
    ).toBe('1.20');
  });

  it('keeps an empty input empty', () => {
    expect(formatPurchaseInvoiceCountInput(null)).toBe('');
    expect(formatPurchaseInvoiceCountInput(undefined)).toBe('');
    expect(formatPurchaseInvoiceCountInput('')).toBe('');
  });
});
