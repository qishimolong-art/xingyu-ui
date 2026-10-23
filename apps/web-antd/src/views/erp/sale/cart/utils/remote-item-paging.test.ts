import { describe, expect, it } from 'vitest';

import {
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getRemoteCreatedItemNavigationPlan,
  getRemoteCreatedItemsNavigationPlan,
  getRemoteCreatedItemPageNo,
  getRemoteItemTotal,
} from './remote-item-paging';

describe('sale cart remote item paging', () => {
  it('fills a persisted page after deleted rows are excluded by the backend', () => {
    const rows = composeRemoteItemPage({
      createdRows: [],
      pageNo: 1,
      pageSize: 10,
      persistedRows: Array.from({ length: 10 }, (_, index) => ({
        id: index + 9,
      })),
      persistedTotal: 364,
    });

    expect(rows).toHaveLength(10);
    expect(rows.map(({ id }) => id)).toEqual([
      9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    ]);
    expect(getRemoteItemTotal(364, 0)).toBe(364);
  });

  it('uses pending creates to fill the persisted last page and subsequent pages', () => {
    const createdRows: Array<{ id?: number; key?: string }> = Array.from(
      { length: 12 },
      (_, index) => ({
        key: `new-${index + 1}`,
      }),
    );

    expect(
      composeRemoteItemPage<{ id?: number; key?: string }>({
        createdRows,
        pageNo: 2,
        pageSize: 10,
        persistedRows: [{ id: 11 }, { id: 12 }],
        persistedTotal: 12,
      }),
    ).toEqual([{ id: 11 }, { id: 12 }, ...createdRows.slice(0, 8)]);
    expect(
      composeRemoteItemPage({
        createdRows,
        pageNo: 3,
        pageSize: 10,
        persistedRows: [],
        persistedTotal: 12,
      }),
    ).toEqual(createdRows.slice(8));
  });

  it('never composes more persisted rows than the configured page size', () => {
    expect(
      composeRemoteItemPage<{ id?: number; key?: string }>({
        createdRows: [{ key: 'new-1' }],
        pageNo: 1,
        pageSize: 10,
        persistedRows: Array.from({ length: 11 }, (_, index) => ({
          id: index + 1,
        })),
        persistedTotal: 11,
      }),
    ).toHaveLength(10);
  });

  it('places the eleventh row on page two and locates the first batch insert', () => {
    expect(getRemoteCreatedItemPageNo(10, ['new-1'], 'new-1', 10)).toBe(2);
    expect(
      getRemoteCreatedItemPageNo(
        18,
        ['old-create', 'new-1', 'new-2'],
        'new-1',
        10,
      ),
    ).toBe(2);
  });

  it('clamps an emptied last page to the new last page', () => {
    expect(clampRemoteItemPageNo(4, 10, 30)).toBe(3);
    expect(clampRemoteItemPageNo(2, 10, 0)).toBe(1);
  });

  it.each([10, 20, 50, 100, 200])(
    'keeps page boundaries stable for page size %i',
    (pageSize) => {
      const keys = ['new'];
      expect(getRemoteCreatedItemPageNo(pageSize, keys, 'new', pageSize)).toBe(
        2,
      );
    },
  );

  it.each([
    {
      currentPageNo: 1,
      expectedPageNo: 1,
      expectedRequest: false,
      persistedTotal: 8,
      title: 'appends the ninth row on the loaded last page',
    },
    {
      currentPageNo: 1,
      expectedPageNo: 2,
      expectedRequest: false,
      persistedTotal: 10,
      title: 'opens a create-only second page for the eleventh row',
    },
    {
      currentPageNo: 1,
      expectedPageNo: 2,
      expectedRequest: true,
      persistedTotal: 15,
      title: 'loads a mixed persisted last page when it is not loaded',
    },
    {
      currentPageNo: 2,
      expectedPageNo: 2,
      expectedRequest: false,
      persistedTotal: 15,
      title: 'reuses a mixed persisted last page when it is loaded',
    },
  ])(
    '$title',
    ({ currentPageNo, expectedPageNo, expectedRequest, persistedTotal }) => {
      expect(
        getRemoteCreatedItemNavigationPlan({
          createdKeys: ['new-1'],
          currentPageNo,
          pageSize: 10,
          persistedTotal,
          targetKey: 'new-1',
        }),
      ).toEqual({
        requiresPageRequest: expectedRequest,
        targetPageHasPersistedRows: persistedTotal % 10 !== 0,
        targetPageNo: expectedPageNo,
      });
    },
  );

  it('reloads a persisted target page when active sorting must be cleared', () => {
    expect(
      getRemoteCreatedItemNavigationPlan({
        createdKeys: ['new-1'],
        currentPageNo: 2,
        orderField: 'productCode',
        pageSize: 10,
        persistedTotal: 15,
        targetKey: 'new-1',
      }),
    ).toEqual({
      requiresPageRequest: true,
      targetPageHasPersistedRows: true,
      targetPageNo: 2,
    });
  });

  it('uses the effective persisted total after pending deletes', () => {
    expect(
      getRemoteCreatedItemNavigationPlan({
        createdKeys: ['new-1'],
        currentPageNo: 1,
        pageSize: 10,
        persistedTotal: 9,
        targetKey: 'new-1',
      }),
    ).toEqual({
      requiresPageRequest: false,
      targetPageHasPersistedRows: true,
      targetPageNo: 1,
    });
  });

  it('keeps repeated creates local when they cross create-only pages', () => {
    const createdKeys = Array.from(
      { length: 11 },
      (_, index) => `new-${index + 1}`,
    );

    expect(
      getRemoteCreatedItemNavigationPlan({
        createdKeys,
        currentPageNo: 2,
        pageSize: 10,
        persistedTotal: 10,
        targetKey: 'new-11',
      }),
    ).toEqual({
      requiresPageRequest: false,
      targetPageHasPersistedRows: false,
      targetPageNo: 3,
    });
  });

  it('opens the new last page when a three-row batch crosses a page boundary', () => {
    expect(
      getRemoteCreatedItemsNavigationPlan({
        createdKeys: ['new-1', 'new-2', 'new-3'],
        currentPageNo: 1,
        pageSize: 10,
        persistedTotal: 9,
        targetKeys: ['new-1', 'new-2', 'new-3'],
      }),
    ).toEqual({
      focusKey: 'new-2',
      requiresPageRequest: false,
      targetPageHasPersistedRows: false,
      targetPageNo: 2,
    });
  });

  it('focuses the first row from the batch that belongs to the final page', () => {
    expect(
      getRemoteCreatedItemsNavigationPlan({
        createdKeys: ['old-create', 'new-1', 'new-2', 'new-3'],
        currentPageNo: 2,
        pageSize: 10,
        persistedTotal: 18,
        targetKeys: ['new-1', 'new-2', 'new-3'],
      }),
    ).toEqual({
      focusKey: 'new-2',
      requiresPageRequest: false,
      targetPageHasPersistedRows: false,
      targetPageNo: 3,
    });
  });
});
