import { describe, expect, it } from 'vitest';

import { sortOtherIncomeItems } from './other-income-item-sort';

describe('other income item sorting', () => {
  it('sorts numeric values numerically and keeps blanks last in both directions', () => {
    const rows = [{ id: 1, amount: 10 }, { id: 2 }, { id: 3, amount: 2 }];

    expect(
      sortOtherIncomeItems(rows, 'amount', 'asc').map((row) => row.id),
    ).toEqual([3, 1, 2]);
    expect(
      sortOtherIncomeItems(rows, 'amount', 'desc').map((row) => row.id),
    ).toEqual([1, 3, 2]);
  });

  it('sorts department and handler columns by their displayed labels', () => {
    const rows = [
      { id: 1, deptId: 2, handlerId: 20 },
      { id: 2, deptId: 1, handlerId: 10 },
    ];
    const context = {
      deptOptions: [
        { label: '财务部', value: 1 },
        { label: '行政部', value: 2 },
      ],
      userOptions: [
        { label: '李四', value: 10 },
        { label: '张三', value: 20 },
      ],
    };

    expect(
      sortOtherIncomeItems(rows, 'deptId', 'asc', context).map((row) => row.id),
    ).toEqual([2, 1]);
    expect(
      sortOtherIncomeItems(rows, 'handlerId', 'asc', context).map(
        (row) => row.id,
      ),
    ).toEqual([2, 1]);
  });

  it('keeps equal displayed values stable', () => {
    const rows = [
      { id: 1, itemName: '补贴' },
      { id: 2, itemName: '补贴' },
      { id: 3, itemName: '利息' },
    ];

    expect(
      sortOtherIncomeItems(rows, 'itemName', 'asc').map((row) => row.id),
    ).toEqual([1, 2, 3]);
  });
});
