import { describe, expect, it } from 'vitest';

import { resolvePurchaseOrderItemSortValue } from './purchase-order-item-sort';
import { sortPurchaseDocumentItems } from '../../utils/document-item-table';

describe('purchase order item sort values', () => {
  const context = {
    warehouseOptions: [
      { id: 1, name: 'B warehouse' },
      { id: 2, name: 'A warehouse' },
    ],
    deptOptions: [
      {
        id: 10,
        name: 'Head office',
        children: [{ id: 11, name: 'Branch office' }],
      },
    ],
  };

  it('sorts selector columns by their displayed names instead of ids', () => {
    expect(
      resolvePurchaseOrderItemSortValue(
        { warehouseId: 2 },
        'warehouseId',
        context,
      ),
    ).toBe('A warehouse');
    expect(
      resolvePurchaseOrderItemSortValue({ deptId: 11 }, 'deptId', context),
    ).toBe('Branch office');
    expect(
      resolvePurchaseOrderItemSortValue(
        { productId: 99, productName: 'Brake pad' },
        'productId',
        context,
      ),
    ).toBe('Brake pad');
  });

  it('sorts inbound status by the three displayed status levels', () => {
    expect(
      resolvePurchaseOrderItemSortValue({ count: 10, inCount: 0 }, 'inStatus'),
    ).toBe(0);
    expect(
      resolvePurchaseOrderItemSortValue({ count: 10, inCount: 3 }, 'inStatus'),
    ).toBe(1);
    expect(
      resolvePurchaseOrderItemSortValue({ count: 10, inCount: 10 }, 'inStatus'),
    ).toBe(2);
  });

  it('keeps numeric and text business fields unchanged', () => {
    expect(resolvePurchaseOrderItemSortValue({ count: 12.5 }, 'count')).toBe(
      12.5,
    );
    expect(
      resolvePurchaseOrderItemSortValue(
        { productCode: 'P-002' },
        'productCode',
      ),
    ).toBe('P-002');
  });

  it('sorts numeric strings numerically and keeps blanks last', () => {
    const rows = [
      { count: '', id: 4 },
      { count: '10', id: 3 },
      { count: '2', id: 2 },
      { count: null, id: 1 },
    ];
    expect(
      sortPurchaseDocumentItems(rows, 'count', 'asc').map((row) => row.id),
    ).toEqual([2, 3, 1, 4]);
    expect(
      sortPurchaseDocumentItems(rows, 'count', 'desc').map((row) => row.id),
    ).toEqual([3, 2, 1, 4]);
  });

  it('uses quantity divided by package quantity for piece count and persisted id for ties', () => {
    const rows = [
      { count: '10', id: 8, packageQty: '5' },
      { count: 4, id: 2, packageQty: 2 },
      { count: 6, id: 5, packageQty: 2 },
    ];
    expect(
      sortPurchaseDocumentItems(rows, 'pieceCount', 'asc').map((row) => row.id),
    ).toEqual([2, 8, 5]);
  });
});
