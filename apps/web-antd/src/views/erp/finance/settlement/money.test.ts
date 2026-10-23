import { describe, expect, it } from 'vitest';

import {
  calculateSettlementDocumentAmounts,
  createProgrammaticFinanceAmountGuard,
  normalizeFinanceAmount,
  subtractFinanceAmounts,
  sumFinanceAmounts,
} from './money';

describe('finance settlement money arithmetic', () => {
  it('calculates outstanding amounts without introducing floating point tails', () => {
    expect(subtractFinanceAmounts(100.01, 0.02)).toBe('99.99');
    expect(normalizeFinanceAmount('99.990000')).toBe('99.99');
  });

  it('keeps signed returns and price adjustments while summing', () => {
    expect(sumFinanceAmounts([100.01, -20.02, 0.01, -0.01])).toBe('79.99');
    expect(calculateSettlementDocumentAmounts([100.01, 5, -20.02], 0)).toEqual({
      allocatedPrice: '84.99',
      totalPrice: '84.99',
      actualPrice: '84.99',
    });
  });

  it('keeps an explicitly edited total while recalculating actual amount', () => {
    expect(
      calculateSettlementDocumentAmounts([100, -20], 2, {
        currentTotalPrice: 90,
        totalPriceManuallyEdited: true,
      }),
    ).toEqual({
      allocatedPrice: '80',
      totalPrice: '90',
      actualPrice: '88',
    });
  });

  it('preserves signed amounts with exact decimal arithmetic', () => {
    expect(subtractFinanceAmounts(-100.01, -0.02)).toBe('-99.99');
  });

  it('recognizes delayed programmatic amount changes without hiding later user edits', () => {
    const guard = createProgrammaticFinanceAmountGuard();

    guard.expect('84.990000');
    expect(guard.isExpected(84.99)).toBe(true);
    expect(guard.isExpected(84.99)).toBe(true);
    expect(guard.isExpected(85)).toBe(false);

    guard.clear();
    expect(guard.isExpected(84.99)).toBe(false);
  });
});
