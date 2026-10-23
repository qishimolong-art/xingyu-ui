import { describe, expect, it } from 'vitest';

import {
  hasValidStockCheckDraftItems,
  hasValidStockTransferDraftItems,
  hasValidWarehouseMoveDraftItems,
} from './draft-items';

describe('stock draft minimum item checks', () => {
  it('requires product, source warehouse and a positive count for transfer-out drafts', () => {
    expect(hasValidStockTransferDraftItems([])).toBe(false);
    expect(
      hasValidStockTransferDraftItems([
        { productId: 1, toWarehouseId: 20, count: 1 },
      ]),
    ).toBe(false);
    expect(
      hasValidStockTransferDraftItems([
        { productId: 1, fromWarehouseId: 10, toWarehouseId: 20, count: 0 },
      ]),
    ).toBe(false);
    expect(
      hasValidStockTransferDraftItems([
        { productId: 1, fromWarehouseId: 10, count: 1 },
      ]),
    ).toBe(true);
    expect(
      hasValidStockTransferDraftItems([
        { productId: 1, fromWarehouseId: 10, toWarehouseId: 20, count: 1 },
      ]),
    ).toBe(true);
  });

  it('requires product and a positive count for warehouse-move drafts', () => {
    expect(hasValidWarehouseMoveDraftItems([{ productId: 1, count: 1 }])).toBe(
      false,
    );
    expect(
      hasValidWarehouseMoveDraftItems([{ productId: 1, count: 1 }], 10, 10),
    ).toBe(false);
    expect(
      hasValidWarehouseMoveDraftItems([{ productId: 1, count: 0 }], 10, 20),
    ).toBe(false);
    expect(hasValidWarehouseMoveDraftItems([{ count: 1 }], 10, 20)).toBe(false);
    expect(
      hasValidWarehouseMoveDraftItems([{ productId: 1, count: 1 }], 10, 20),
    ).toBe(true);
  });

  it('allows zero or negative count values for stock-check count drafts when the row is explicit', () => {
    expect(
      hasValidStockCheckDraftItems([
        { productId: 1, warehouseId: 10, count: undefined },
      ]),
    ).toBe(false);
    expect(
      hasValidStockCheckDraftItems([
        { productId: 1, warehouseId: 10, count: 0 },
      ]),
    ).toBe(true);
    expect(
      hasValidStockCheckDraftItems([
        { productId: 1, warehouseId: 10, count: -1 },
      ]),
    ).toBe(true);
  });

  it('uses explicit total price for stock-check cost drafts', () => {
    expect(
      hasValidStockCheckDraftItems(
        [{ productId: 1, warehouseId: 10, totalPrice: undefined }],
        2,
      ),
    ).toBe(false);
    expect(
      hasValidStockCheckDraftItems(
        [{ productId: 1, warehouseId: 10, totalPrice: 0 }],
        2,
      ),
    ).toBe(true);
  });
});
