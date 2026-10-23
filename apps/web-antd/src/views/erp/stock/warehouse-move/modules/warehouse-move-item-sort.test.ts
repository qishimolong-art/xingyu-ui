import { describe, expect, it } from 'vitest';

import {
  resolveWarehouseMoveItemSortValue,
  sortWarehouseMoveItems,
} from './warehouse-move-item-sort';

describe('warehouse move item sorting', () => {
  it('sorts product and warehouse columns by their displayed names', () => {
    expect(
      resolveWarehouseMoveItemSortValue(
        { fromWarehouseName: '北仓' },
        'fromWarehouseId',
      ),
    ).toBe('北仓');
    expect(
      sortWarehouseMoveItems(
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
      { id: 1, count: '10' },
      { id: 2, count: '2' },
    ];

    expect(
      sortWarehouseMoveItems(rows, 'count', 'asc').map((item) => item.id),
    ).toEqual([2, 1]);
  });

  it('keeps blanks last in both directions and remains stable', () => {
    const rows = [
      { id: 1, remark: '' },
      { id: 4, remark: 'B' },
      { id: 3, remark: undefined },
      { id: 2, remark: 'B' },
    ];

    expect(
      sortWarehouseMoveItems(rows, 'remark', 'asc').map((item) => item.id),
    ).toEqual([2, 4, 1, 3]);
    expect(
      sortWarehouseMoveItems(rows, 'remark', 'desc').map((item) => item.id),
    ).toEqual([2, 4, 1, 3]);
  });
});
