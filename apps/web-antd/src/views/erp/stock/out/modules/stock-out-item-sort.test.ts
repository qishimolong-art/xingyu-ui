import { describe, expect, it } from 'vitest';

import { sortStockOutItems } from './stock-out-item-sort';

describe('stock out item sorting', () => {
  it('sorts numeric strings numerically without mutating source rows', () => {
    const rows = [
      { id: 1, count: '12' },
      { id: 2, count: '3' },
      { id: 3, count: '8' },
    ];

    expect(sortStockOutItems(rows, 'count', 'asc').map(({ id }) => id)).toEqual(
      [2, 3, 1],
    );
    expect(
      sortStockOutItems(rows, 'count', 'desc').map(({ id }) => id),
    ).toEqual([1, 3, 2]);
    expect(rows.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it('sorts the displayed product and warehouse names', () => {
    const rows = [
      { id: 1, productId: 9, productName: '雨刷', warehouseId: 2 },
      { id: 2, productId: 1, productName: '轮胎', warehouseId: 1 },
    ];
    const warehouses = [
      { id: 1, name: '北仓' },
      { id: 2, name: '南仓' },
    ];

    expect(
      sortStockOutItems(rows, 'productId', 'asc').map(({ id }) => id),
    ).toEqual([2, 1]);
    expect(
      sortStockOutItems(rows, 'warehouseId', 'desc', warehouses).map(
        ({ id }) => id,
      ),
    ).toEqual([1, 2]);
  });

  it('keeps blanks last and equal values stable in both directions', () => {
    const rows = [
      { id: 1, remark: undefined },
      { id: 2, remark: '三包换件' },
      { id: 3, remark: '' },
      { id: 4, remark: '三包换件' },
      { id: 5, remark: '领用' },
    ];

    expect(
      sortStockOutItems(rows, 'remark', 'asc').map(({ id }) => id),
    ).toEqual([5, 2, 4, 1, 3]);
    expect(
      sortStockOutItems(rows, 'remark', 'desc').map(({ id }) => id),
    ).toEqual([2, 4, 5, 1, 3]);
  });

  it('restores source order when sorting is cleared', () => {
    const rows = [{ id: 3 }, { id: 1 }, { id: 2 }];
    expect(sortStockOutItems(rows).map(({ id }) => id)).toEqual([3, 1, 2]);
  });
});
