import { describe, expect, it } from 'vitest';

import {
  resolveStockQuantityDetailSortValue,
  sortStockQuantityDetails,
} from './stock-quantity-detail-sort';

describe('stock quantity detail sorting', () => {
  it('compares quantities numerically and text with natural ordering', () => {
    const rows = [
      { id: 1, count: 10, no: 'RK10' },
      { id: 2, count: 2, no: 'RK2' },
    ];

    expect(
      sortStockQuantityDetails(rows, 'count', 'asc').map((item) => item.id),
    ).toEqual([2, 1]);
    expect(
      sortStockQuantityDetails(rows, 'no', 'asc').map((item) => item.id),
    ).toEqual([2, 1]);
  });

  it('sorts creator and time by their displayed values', () => {
    expect(
      resolveStockQuantityDetailSortValue(
        { creator: '备用名称', creatorName: '' },
        'creatorName',
      ),
    ).toBe('备用名称');
    expect(
      sortStockQuantityDetails(
        [
          { id: 1, createTime: '2026-07-20 10:00:00' },
          { id: 2, createTime: '2026-07-19 10:00:00' },
        ],
        'createTime',
        'asc',
      ).map((item) => item.id),
    ).toEqual([2, 1]);
  });

  it('keeps blanks last in both directions and remains stable', () => {
    const rows = [
      { id: 1, standard: '' },
      { id: 2, standard: 'A' },
      { id: 3, standard: undefined },
      { id: 4, standard: 'A' },
    ];

    expect(
      sortStockQuantityDetails(rows, 'standard', 'asc').map((item) => item.id),
    ).toEqual([2, 4, 1, 3]);
    expect(
      sortStockQuantityDetails(rows, 'standard', 'desc').map((item) => item.id),
    ).toEqual([2, 4, 1, 3]);
  });
});
