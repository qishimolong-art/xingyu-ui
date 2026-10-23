import { describe, expect, it } from 'vitest';

import {
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getCreatedRowPageNo,
  getRemoteItemTotal,
  pageHasPersistedRows,
} from './remote-item-paging';

describe('purchase remote item paging', () => {
  it('fills a page after persisted deletes are excluded by the backend', () => {
    const rows = composeRemoteItemPage({
      createdRows: [],
      pageNo: 2,
      pageSize: 10,
      persistedRows: Array.from({ length: 10 }, (_, index) => index + 11),
      persistedTotal: 29,
    });
    expect(rows).toHaveLength(10);
    expect(getRemoteItemTotal(29, 0)).toBe(29);
  });

  it('places pending creates after persisted rows without overflowing a page', () => {
    const createdRows = ['new-1', 'new-2', 'new-3'];
    expect(
      composeRemoteItemPage({
        createdRows,
        pageNo: 2,
        pageSize: 10,
        persistedRows: Array.from({ length: 9 }, (_, index) => `old-${index}`),
        persistedTotal: 19,
      }),
    ).toEqual([
      'old-0',
      'old-1',
      'old-2',
      'old-3',
      'old-4',
      'old-5',
      'old-6',
      'old-7',
      'old-8',
      'new-1',
    ]);
    expect(
      composeRemoteItemPage({
        createdRows,
        pageNo: 3,
        pageSize: 10,
        persistedRows: [],
        persistedTotal: 19,
      }),
    ).toEqual(['new-2', 'new-3']);
  });

  it('handles exact boundaries, deleted last pages and invalid page sizes', () => {
    expect(getCreatedRowPageNo(20, 0, 10)).toBe(3);
    expect(getCreatedRowPageNo(19, 0, 10)).toBe(2);
    expect(clampRemoteItemPageNo(4, 10, 30)).toBe(3);
    expect(pageHasPersistedRows(2, 10, 15)).toBe(true);
    expect(pageHasPersistedRows(3, 10, 15)).toBe(false);
    expect(
      composeRemoteItemPage({
        createdRows: [1],
        pageNo: 1,
        pageSize: 0,
        persistedRows: [2, 3],
        persistedTotal: 2,
      }),
    ).toHaveLength(1);
  });
});
