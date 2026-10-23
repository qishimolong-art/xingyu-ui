import { describe, expect, it } from 'vitest';

import {
  clampFinanceRemoteItemPageNo,
  composeFinanceRemoteItemPage,
  getFinanceCreatedRowPageNo,
  getFinanceRemoteItemTotal,
} from './remote-item-paging';

describe('finance remote item paging', () => {
  it('never overflows when pending creates cross a page boundary', () => {
    const createdRows = ['new-1', 'new-2', 'new-3'];
    expect(
      composeFinanceRemoteItemPage({
        createdRows,
        pageNo: 2,
        pageSize: 10,
        persistedRows: Array.from({ length: 9 }, (_, index) => `old-${index}`),
        persistedTotal: 19,
      }),
    ).toHaveLength(10);
    expect(
      composeFinanceRemoteItemPage({
        createdRows,
        pageNo: 3,
        pageSize: 10,
        persistedRows: [],
        persistedTotal: 19,
      }),
    ).toEqual(['new-2', 'new-3']);
  });

  it('handles exact boundaries and deleted last pages', () => {
    expect(getFinanceCreatedRowPageNo(19, 0, 10)).toBe(2);
    expect(getFinanceCreatedRowPageNo(20, 0, 10)).toBe(3);
    expect(getFinanceRemoteItemTotal(18, 2)).toBe(20);
    expect(clampFinanceRemoteItemPageNo(4, 10, 29)).toBe(3);
  });
});
