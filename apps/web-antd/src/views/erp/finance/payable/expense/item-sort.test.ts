import { describe, expect, it } from 'vitest';

import { sortPayableExpenseItems } from './item-sort';

describe('payable expense item sorting', () => {
  it('sorts numbers numerically and keeps blanks last in both directions', () => {
    const rows = [{ id: 1, amount: 10 }, { id: 2 }, { id: 3, amount: 2 }];

    expect(
      sortPayableExpenseItems(rows, 'amount', 'asc').map((row) => row.id),
    ).toEqual([3, 1, 2]);
    expect(
      sortPayableExpenseItems(rows, 'amount', 'desc').map((row) => row.id),
    ).toEqual([1, 3, 2]);
  });

  it('sorts dates and displayed names while preserving stable ties', () => {
    const rows = [
      { id: 1, bizDate: '2026-01-02', deptName: '财务部' },
      { id: 2, bizDate: '2026-01-01', deptName: '行政部' },
      { id: 3, bizDate: '2026-01-03', deptName: '财务部' },
    ];

    expect(
      sortPayableExpenseItems(rows, 'bizDate', 'asc').map((row) => row.id),
    ).toEqual([2, 1, 3]);
    expect(
      sortPayableExpenseItems(rows, 'deptName', 'asc').map((row) => row.id),
    ).toEqual([1, 3, 2]);
  });
});
