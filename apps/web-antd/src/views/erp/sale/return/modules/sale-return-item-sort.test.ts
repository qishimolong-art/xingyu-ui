import { describe, expect, it } from 'vitest';

import {
  resolveSaleReturnItemSortValue,
  sortSaleReturnItems,
} from './sale-return-item-sort';

describe('sale return item sorting', () => {
  const context = {
    deptOptions: [{ id: 11, name: '销售一部' }],
    warehouseOptions: [{ id: 2, name: '成都仓' }],
  };

  it('sorts by displayed product, warehouse and department names', () => {
    expect(
      resolveSaleReturnItemSortValue(
        { productId: 99, productName: '刹车片' },
        'productId',
        context,
      ),
    ).toBe('刹车片');
    expect(
      resolveSaleReturnItemSortValue(
        { warehouseId: 2 },
        'warehouseId',
        context,
      ),
    ).toBe('成都仓');
    expect(
      resolveSaleReturnItemSortValue({ deptId: 11 }, 'deptId', context),
    ).toBe('销售一部');
  });

  it('sorts numeric strings in both directions without mutating source rows', () => {
    const rows = [
      { id: 1, count: '12' },
      { id: 2, count: '3' },
      { id: 3, count: '8' },
    ];
    expect(
      sortSaleReturnItems(rows, 'count', 'asc').map(({ id }) => id),
    ).toEqual([2, 3, 1]);
    expect(
      sortSaleReturnItems(rows, 'count', 'desc').map(({ id }) => id),
    ).toEqual([1, 3, 2]);
    expect(rows.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it('keeps blanks last and orders equal values by id in either direction', () => {
    const rows = [
      { id: 1, remark: undefined },
      { id: 2, remark: 'B' },
      { id: 3, remark: '' },
      { id: 4, remark: 'B' },
      { id: 5, remark: 'A' },
    ];
    expect(
      sortSaleReturnItems(rows, 'remark', 'asc').map(({ id }) => id),
    ).toEqual([5, 2, 4, 1, 3]);
    expect(
      sortSaleReturnItems(rows, 'remark', 'desc').map(({ id }) => id),
    ).toEqual([2, 4, 5, 1, 3]);
  });
});
