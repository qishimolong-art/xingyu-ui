import { describe, expect, it } from 'vitest';

import {
  resolveSaleCartItemSortValue,
  sortSaleCartItems,
} from './sale-cart-item-sort';

describe('sale cart item sorting', () => {
  const context = {
    warehouseOptions: [
      { id: 1, name: 'B仓', deptId: 10, deptName: '二部' },
      { id: 2, name: 'A仓', deptId: 11, deptName: '一部' },
    ],
    deptOptions: [
      {
        id: 10,
        name: '总部',
        children: [{ id: 11, name: '分部' }],
      },
    ],
  };

  it('uses displayed product, warehouse and department names instead of ids', () => {
    expect(
      resolveSaleCartItemSortValue(
        { productId: 99, productName: '刹车片' },
        'productId',
        context,
      ),
    ).toBe('刹车片');
    expect(
      resolveSaleCartItemSortValue({ warehouseId: 2 }, 'warehouseId', context),
    ).toBe('A仓');
    expect(
      resolveSaleCartItemSortValue(
        { warehouseId: 2 },
        'warehouseDeptName',
        context,
      ),
    ).toBe('一部');
    expect(
      resolveSaleCartItemSortValue({ deptId: 11 }, 'deptId', context),
    ).toBe('分部');
  });

  it('sorts numbers in both directions without changing the source array', () => {
    const rows = [
      { id: 1, count: 12 },
      { id: 2, count: 3 },
      { id: 3, count: 8 },
    ];

    expect(sortSaleCartItems(rows, 'count', 'asc').map(({ id }) => id)).toEqual(
      [2, 3, 1],
    );
    expect(
      sortSaleCartItems(rows, 'count', 'desc').map(({ id }) => id),
    ).toEqual([1, 3, 2]);
    expect(rows.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it('keeps empty values last and equal values stable', () => {
    const rows = [
      { id: 1, brand: undefined },
      { id: 2, brand: '瑞云' },
      { id: 3, brand: '' },
      { id: 4, brand: '瑞云' },
      { id: 5, brand: '安达' },
    ];

    expect(sortSaleCartItems(rows, 'brand', 'asc').map(({ id }) => id)).toEqual(
      [5, 2, 4, 1, 3],
    );
    expect(
      sortSaleCartItems(rows, 'brand', 'desc').map(({ id }) => id),
    ).toEqual([2, 4, 5, 1, 3]);
  });

  it('sorts gift rows by the displayed checkbox state', () => {
    const rows = [
      { id: 1, giftFlag: true },
      { id: 2, giftFlag: false },
    ];
    expect(
      sortSaleCartItems(rows, 'giftFlag', 'asc').map(({ id }) => id),
    ).toEqual([2, 1]);
  });
});
