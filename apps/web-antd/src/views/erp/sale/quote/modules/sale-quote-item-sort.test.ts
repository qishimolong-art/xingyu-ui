import { describe, expect, it } from 'vitest';

import {
  resolveSaleQuoteItemSortValue,
  sortSaleQuoteItems,
} from './sale-quote-item-sort';

describe('sale quote item sorting', () => {
  const context = {
    warehouseOptions: [
      { id: 1, name: 'B仓' },
      { id: 2, name: 'A仓' },
    ],
    deptOptions: [
      {
        id: 10,
        name: '总部',
        children: [{ id: 11, name: '分部' }],
      },
    ],
  };

  it('sorts select columns by their displayed names', () => {
    expect(
      resolveSaleQuoteItemSortValue(
        { productId: 99, productName: '刹车片' },
        'productId',
        context,
      ),
    ).toBe('刹车片');
    expect(
      resolveSaleQuoteItemSortValue({ warehouseId: 2 }, 'warehouseId', context),
    ).toBe('A仓');
    expect(
      resolveSaleQuoteItemSortValue({ deptId: 11 }, 'deptId', context),
    ).toBe('分部');
  });

  it('sorts numeric strings numerically without mutating source rows', () => {
    const rows = [
      { id: 1, count: '12' },
      { id: 2, count: '3' },
      { id: 3, count: '8' },
    ];

    expect(
      sortSaleQuoteItems(rows, 'count', 'asc').map(({ id }) => id),
    ).toEqual([2, 3, 1]);
    expect(
      sortSaleQuoteItems(rows, 'count', 'desc').map(({ id }) => id),
    ).toEqual([1, 3, 2]);
    expect(rows.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it('keeps blanks last and orders equal values by id in both directions', () => {
    const rows = [
      { id: 1, brand: undefined },
      { id: 2, brand: '瑞云' },
      { id: 3, brand: '' },
      { id: 4, brand: '瑞云' },
      { id: 5, brand: '安达' },
    ];

    expect(
      sortSaleQuoteItems(rows, 'brand', 'asc').map(({ id }) => id),
    ).toEqual([5, 2, 4, 1, 3]);
    expect(
      sortSaleQuoteItems(rows, 'brand', 'desc').map(({ id }) => id),
    ).toEqual([2, 4, 5, 1, 3]);
  });
});
