import { describe, expect, it } from 'vitest';

import {
  isStockInItemSortField,
  resolveStockInItemSortValue,
  sortStockInItems,
} from './stock-in-item-sort';

describe('stock-in item sorting', () => {
  const context = {
    warehouseOptions: [
      { id: 1, name: 'B 仓库' },
      { id: 2, name: 'A 仓库' },
    ],
  };

  it('uses displayed product and warehouse names instead of ids', () => {
    expect(
      resolveStockInItemSortValue(
        { productId: 99, productName: '刹车片' },
        'productId',
        context,
      ),
    ).toBe('刹车片');
    expect(
      resolveStockInItemSortValue({ warehouseId: 2 }, 'warehouseId', context),
    ).toBe('A 仓库');
  });

  it('sorts numeric strings numerically without changing the source array', () => {
    const rows = [
      { id: 1, count: '12' },
      { id: 2, count: '3' },
      { id: 3, count: '8' },
    ];

    expect(sortStockInItems(rows, 'count', 'asc').map(({ id }) => id)).toEqual([
      2, 3, 1,
    ]);
    expect(sortStockInItems(rows, 'count', 'desc').map(({ id }) => id)).toEqual(
      [1, 3, 2],
    );
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

    expect(sortStockInItems(rows, 'remark', 'asc').map(({ id }) => id)).toEqual(
      [5, 2, 4, 1, 3],
    );
    expect(
      sortStockInItems(rows, 'remark', 'desc').map(({ id }) => id),
    ).toEqual([2, 4, 5, 1, 3]);
  });

  it('rejects sequence and non-column fields', () => {
    const rows = [{ id: 2 }, { id: 1 }];
    expect(isStockInItemSortField('seq')).toBe(false);
    expect(sortStockInItems(rows, 'seq', 'asc')).toEqual(rows);
  });
});
