import { describe, expect, it } from 'vitest';

import {
  resolveTransferOutItemSortValue,
  sortTransferOutItems,
} from './transfer-out-item-sort';

describe('transfer-out item sorting', () => {
  const context = {
    fromWarehouseOptions: [
      { id: 1, name: 'B 调出仓' },
      { id: 2, name: 'A 调出仓' },
    ],
    toWarehouseOptions: [
      { id: 3, name: 'D 调入仓' },
      { id: 4, name: 'C 调入仓' },
    ],
  };

  it('uses displayed product and warehouse names instead of ids', () => {
    expect(
      resolveTransferOutItemSortValue(
        { productId: 99, productName: '刹车片' },
        'productId',
        context,
      ),
    ).toBe('刹车片');
    expect(
      resolveTransferOutItemSortValue(
        { fromWarehouseId: 2 },
        'fromWarehouseId',
        context,
      ),
    ).toBe('A 调出仓');
    expect(
      resolveTransferOutItemSortValue(
        { toWarehouseId: 4 },
        'toWarehouseId',
        context,
      ),
    ).toBe('C 调入仓');
  });

  it('sorts numbers in both directions without changing the source array', () => {
    const rows = [
      { id: 1, count: 12 },
      { id: 2, count: 3 },
      { id: 3, count: 8 },
    ];

    expect(
      sortTransferOutItems(rows, 'count', 'asc').map(({ id }) => id),
    ).toEqual([2, 3, 1]);
    expect(
      sortTransferOutItems(rows, 'count', 'desc').map(({ id }) => id),
    ).toEqual([1, 3, 2]);
    expect(rows.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it('keeps blank values last and equal values stable', () => {
    const rows = [
      { id: 1, remark: undefined },
      { id: 2, remark: '同一备注' },
      { id: 3, remark: '' },
      { id: 4, remark: '同一备注' },
      { id: 5, remark: '另一备注' },
    ];

    expect(
      sortTransferOutItems(rows, 'remark', 'asc').map(({ id }) => id),
    ).toEqual([5, 2, 4, 1, 3]);
    expect(
      sortTransferOutItems(rows, 'remark', 'desc').map(({ id }) => id),
    ).toEqual([2, 4, 5, 1, 3]);
  });
});
