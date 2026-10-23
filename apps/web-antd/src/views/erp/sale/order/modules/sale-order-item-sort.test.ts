import { describe, expect, it } from 'vitest';

import { sortSaleOrderItems } from './sale-order-item-sort';

describe('sale order item sorting', () => {
  it('sorts the complete local data by displayed names', () => {
    const rows = [
      { id: 2, productId: 20, productName: '制动液' },
      { id: 1, productId: 10, productName: '滤清器' },
    ];
    expect(
      sortSaleOrderItems(rows, 'productId', 'asc').map(({ id }) => id),
    ).toEqual([1, 2]);
    expect(
      sortSaleOrderItems(rows, 'productId', 'desc').map(({ id }) => id),
    ).toEqual([2, 1]);
  });

  it('sorts numeric strings numerically, keeps blanks last and resolves ties by id', () => {
    const rows = [
      { id: 4, count: '' },
      { id: 3, count: '10' },
      { id: 2, count: '2' },
      { id: 1, count: '10' },
    ];
    expect(
      sortSaleOrderItems(rows, 'count', 'asc').map(({ id }) => id),
    ).toEqual([2, 1, 3, 4]);
    expect(
      sortSaleOrderItems(rows, 'count', 'desc').map(({ id }) => id),
    ).toEqual([1, 3, 2, 4]);
  });
});
