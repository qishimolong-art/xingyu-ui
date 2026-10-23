import { describe, expect, it } from 'vitest';

import { hasValidSaleDraftItems } from './draft-items';

describe('hasValidSaleDraftItems', () => {
  it('rejects empty or incomplete sale draft rows', () => {
    expect(hasValidSaleDraftItems([])).toBe(false);
    expect(
      hasValidSaleDraftItems([{ warehouseId: 1, count: 1, productPrice: 1 }]),
    ).toBe(false);
    expect(
      hasValidSaleDraftItems([{ productId: 1, count: 1, productPrice: 1 }]),
    ).toBe(false);
    expect(
      hasValidSaleDraftItems([
        { productId: 1, warehouseId: 2, count: 0, productPrice: 1 },
      ]),
    ).toBe(false);
    expect(
      hasValidSaleDraftItems([{ productId: 1, warehouseId: 2, count: 1 }]),
    ).toBe(false);
  });

  it('accepts normal and gift sale rows', () => {
    expect(
      hasValidSaleDraftItems([
        { productId: 1, warehouseId: 2, count: '1', productPrice: '2.50' },
      ]),
    ).toBe(true);
    expect(
      hasValidSaleDraftItems([
        { productId: 1, warehouseId: 2, count: 1, giftFlag: true },
      ]),
    ).toBe(true);
  });

  it('supports return and price-adjust draft minimums', () => {
    expect(
      hasValidSaleDraftItems(
        [{ productId: 1, warehouseId: 2, count: 1, productPrice: 0 }],
        { priceMode: 'none' },
      ),
    ).toBe(true);
    expect(
      hasValidSaleDraftItems(
        [
          {
            productId: 1,
            warehouseId: 2,
            sourceOutItemId: 3,
            count: 1,
            productPrice: 0,
          },
        ],
        { priceMode: 'nonNegative', requireSaleOutItem: true },
      ),
    ).toBe(true);
    expect(
      hasValidSaleDraftItems(
        [{ productId: 1, saleOutItemId: 3, outCount: 1 }],
        {
          countField: 'outCount',
          priceMode: 'none',
          requireSaleOutItem: true,
          requireWarehouse: false,
        },
      ),
    ).toBe(true);
  });
});
