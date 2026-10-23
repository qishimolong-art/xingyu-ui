import { describe, expect, it } from 'vitest';

import { hasValidPurchaseDraftItems } from './draft-items';

describe('hasValidPurchaseDraftItems', () => {
  it('rejects empty or incomplete stock detail rows', () => {
    expect(hasValidPurchaseDraftItems([])).toBe(false);
    expect(hasValidPurchaseDraftItems([{ warehouseId: 1, count: 1 }])).toBe(
      false,
    );
    expect(hasValidPurchaseDraftItems([{ productId: 1, count: 1 }])).toBe(
      false,
    );
    expect(
      hasValidPurchaseDraftItems([{ productId: 1, warehouseId: 2, count: 0 }]),
    ).toBe(false);
  });

  it('accepts selected stock rows without requiring price', () => {
    expect(
      hasValidPurchaseDraftItems([{ productId: 1, warehouseId: 2, count: 1 }]),
    ).toBe(true);
  });

  it('supports source and price requirements for source-based forms', () => {
    expect(
      hasValidPurchaseDraftItems([{ productId: 1, warehouseId: 2, count: 1 }], {
        requireSourceInItem: true,
      }),
    ).toBe(false);
    expect(
      hasValidPurchaseDraftItems(
        [{ productId: 1, warehouseId: 2, sourceInItemId: 3, count: 1 }],
        { requireSourceInItem: true },
      ),
    ).toBe(true);
    expect(
      hasValidPurchaseDraftItems(
        [{ productId: 1, warehouseId: 2, inItemId: 3, count: 1 }],
        { requireSourceInItem: true },
      ),
    ).toBe(true);
    expect(
      hasValidPurchaseDraftItems([{ productId: 1, count: 1, newPrice: 0 }], {
        requireNewPrice: true,
        requireWarehouse: false,
      }),
    ).toBe(true);
  });
});
