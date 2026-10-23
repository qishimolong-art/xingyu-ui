import { describe, expect, it } from 'vitest';

import {
  resolveStockCheckItemSortValue,
  sortStockCheckItems,
} from './stock-check-item-sort';

describe('stock check item sorting', () => {
  const warehouses = [
    { id: 1, name: '北仓' },
    { id: 2, name: '南仓' },
  ];

  it('sorts warehouse and product columns by their displayed names', () => {
    expect(
      resolveStockCheckItemSortValue({ warehouseId: 2 }, 'warehouseId', {
        warehouseOptions: warehouses,
      }),
    ).toBe('南仓');
    expect(
      sortStockCheckItems(
        [
          { id: 1, productName: '制动片' },
          { id: 2, productName: '火花塞' },
        ],
        'productId',
        'asc',
      ).map((item) => item.id),
    ).toEqual([2, 1]);
  });

  it('compares numeric fields numerically', () => {
    const rows = [
      { id: 1, stockCount: '10' },
      { id: 2, stockCount: '2' },
    ];

    expect(
      sortStockCheckItems(rows, 'stockCount', 'asc').map((item) => item.id),
    ).toEqual([2, 1]);
  });

  it('keeps blanks last in both directions and remains stable', () => {
    const rows = [
      { id: 1, batchNo: '' },
      { id: 4, batchNo: 'B' },
      { id: 3, batchNo: undefined },
      { id: 2, batchNo: 'B' },
    ];

    expect(
      sortStockCheckItems(rows, 'batchNo', 'asc').map((item) => item.id),
    ).toEqual([2, 4, 1, 3]);
    expect(
      sortStockCheckItems(rows, 'batchNo', 'desc').map((item) => item.id),
    ).toEqual([2, 4, 1, 3]);
  });
});
