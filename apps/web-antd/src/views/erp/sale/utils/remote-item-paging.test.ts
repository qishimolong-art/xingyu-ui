import { describe, expect, it } from 'vitest';

import {
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getCreatedRowPageNo,
  getRemoteItemTotal,
  pageHasPersistedRows,
} from './remote-item-paging';

describe('sale remote item paging', () => {
  it('keeps the second page at ten rows for 19 persisted plus one create', () => {
    const rows = composeRemoteItemPage({
      createdRows: ['n1'],
      pageNo: 2,
      pageSize: 10,
      persistedRows: Array.from({ length: 9 }, (_, index) => `p${index + 1}`),
      persistedTotal: 19,
    });
    expect(rows).toHaveLength(10);
    expect(rows.at(-1)).toBe('n1');
  });

  it('places the first create after 20 persisted rows on a pure third page', () => {
    expect(getCreatedRowPageNo(20, 1, 10)).toBe(3);
    expect(
      composeRemoteItemPage({
        createdRows: ['n1'],
        pageNo: 3,
        pageSize: 10,
        persistedRows: [],
        persistedTotal: 20,
      }),
    ).toEqual(['n1']);
  });

  it('splits nine persisted plus three creates into ten and two rows', () => {
    expect(
      composeRemoteItemPage({
        createdRows: ['n1', 'n2', 'n3'],
        pageNo: 1,
        pageSize: 10,
        persistedRows: Array.from({ length: 9 }, (_, index) => `p${index + 1}`),
        persistedTotal: 9,
      }),
    ).toHaveLength(10);
    expect(
      composeRemoteItemPage({
        createdRows: ['n1', 'n2', 'n3'],
        pageNo: 2,
        pageSize: 10,
        persistedRows: [],
        persistedTotal: 9,
      }),
    ).toEqual(['n2', 'n3']);
  });

  it('moves overflow creates to a pure local page', () => {
    expect(getCreatedRowPageNo(19, 2, 10)).toBe(3);
    expect(
      composeRemoteItemPage({
        createdRows: ['n1', 'n2', 'n3'],
        pageNo: 3,
        pageSize: 10,
        persistedRows: [],
        persistedTotal: 19,
      }),
    ).toEqual(['n2', 'n3']);
  });

  it('clamps vanished pages and identifies persisted pages', () => {
    expect(getRemoteItemTotal(8, 3)).toBe(11);
    expect(clampRemoteItemPageNo(3, 10, 11)).toBe(2);
    expect(pageHasPersistedRows(2, 10, 19)).toBe(true);
    expect(pageHasPersistedRows(3, 10, 19)).toBe(false);
  });
});
