import { describe, expect, it } from 'vitest';

import { sortStockOutBillItems } from './outbill-item-sort';

describe('stock out bill item sorting', () => {
  it('sorts numeric values numerically without mutating API rows', () => {
    const rows = [
      { id: 1, count: 12 },
      { id: 2, count: 3 },
      { id: 3, count: 8 },
    ];

    expect(
      sortStockOutBillItems(rows, 'count', 'ascend').map(({ id }) => id),
    ).toEqual([2, 3, 1]);
    expect(
      sortStockOutBillItems(rows, 'count', 'descend').map(({ id }) => id),
    ).toEqual([1, 3, 2]);
    expect(rows.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it('keeps blanks last and equal values stable in both directions', () => {
    const rows = [
      { brand: undefined, id: 1 },
      { brand: '瑞云', id: 2 },
      { brand: '', id: 3 },
      { brand: '瑞云', id: 4 },
      { brand: '安达', id: 5 },
    ];

    expect(
      sortStockOutBillItems(rows, 'brand', 'ascend').map(({ id }) => id),
    ).toEqual([5, 2, 4, 1, 3]);
    expect(
      sortStockOutBillItems(rows, 'brand', 'descend').map(({ id }) => id),
    ).toEqual([2, 4, 5, 1, 3]);
  });

  it('restores source order when the sort is cleared', () => {
    const rows = [{ id: 3 }, { id: 1 }, { id: 2 }];
    expect(sortStockOutBillItems(rows).map(({ id }) => id)).toEqual([3, 1, 2]);
  });
});
