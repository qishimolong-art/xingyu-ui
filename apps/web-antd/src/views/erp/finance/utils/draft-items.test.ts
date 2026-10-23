import { describe, expect, it } from 'vitest';

import {
  hasValidFinanceNamedAmountDraftItems,
  hasValidFinancePaymentDraftItems,
  hasValidFinanceReceiptDraftItems,
} from './draft-items';

describe('finance draft item gates', () => {
  it('requires selected payment business rows with an explicit amount', () => {
    expect(hasValidFinancePaymentDraftItems([])).toBe(false);
    expect(
      hasValidFinancePaymentDraftItems([{ bizType: 1, paymentPrice: 1 }]),
    ).toBe(false);
    expect(
      hasValidFinancePaymentDraftItems([{ bizId: 1, paymentPrice: 1 }]),
    ).toBe(false);
    expect(hasValidFinancePaymentDraftItems([{ bizType: 1, bizId: 1 }])).toBe(
      false,
    );
    expect(
      hasValidFinancePaymentDraftItems([
        { bizType: 1, bizId: 1, paymentPrice: 0 },
      ]),
    ).toBe(true);
  });

  it('requires selected receipt business rows with an explicit amount', () => {
    expect(hasValidFinanceReceiptDraftItems([])).toBe(false);
    expect(
      hasValidFinanceReceiptDraftItems([{ bizType: 1, receiptPrice: 1 }]),
    ).toBe(false);
    expect(
      hasValidFinanceReceiptDraftItems([{ bizId: 1, receiptPrice: 1 }]),
    ).toBe(false);
    expect(hasValidFinanceReceiptDraftItems([{ bizType: 1, bizId: 1 }])).toBe(
      false,
    );
    expect(
      hasValidFinanceReceiptDraftItems([
        { bizType: 1, bizId: 1, receiptPrice: '0' },
      ]),
    ).toBe(true);
  });

  it('requires named finance detail rows with an explicit amount', () => {
    expect(hasValidFinanceNamedAmountDraftItems([])).toBe(false);
    expect(hasValidFinanceNamedAmountDraftItems([{ amount: 1 }])).toBe(false);
    expect(hasValidFinanceNamedAmountDraftItems([{ itemName: '办公费' }])).toBe(
      false,
    );
    expect(
      hasValidFinanceNamedAmountDraftItems([{ itemName: '办公费', amount: 0 }]),
    ).toBe(true);
  });
});
