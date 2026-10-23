import { describe, expect, it } from 'vitest';

import { createVxeHeaderSort } from './vxe-header-sort';

describe('createVxeHeaderSort', () => {
  it('keeps the active sort when no grid sort input is provided', () => {
    const { buildSortParams, handleSortChange } = createVxeHeaderSort({
      no: 'no',
    });

    handleSortChange({ sort: { field: 'no', order: 'desc' } });

    expect(buildSortParams()).toEqual({
      orderDirection: 'desc',
      orderField: 'no',
    });
  });

  it('clears the active sort when VXE explicitly provides an empty sort list', () => {
    const { buildSortParams, handleSortChange } = createVxeHeaderSort({
      no: 'no',
    });

    handleSortChange({ sort: { field: 'no', order: 'desc' } });

    expect(buildSortParams([], undefined)).toEqual({});
    expect(buildSortParams()).toEqual({});
  });

  it('restores the configured default sort after the active header sort is cleared', () => {
    const { buildSortParams, handleSortChange } = createVxeHeaderSort(
      {
        approveTime: 'approveTime',
        productName: 'productName',
      },
      { field: 'approveTime', order: 'desc' },
    );

    expect(buildSortParams()).toEqual({
      orderDirection: 'desc',
      orderField: 'approveTime',
    });

    handleSortChange({
      sort: { field: 'productName', order: 'asc' },
    });
    expect(buildSortParams()).toEqual({
      orderDirection: 'asc',
      orderField: 'productName',
    });

    handleSortChange({ sort: { field: 'productName', order: null } });
    expect(buildSortParams()).toEqual({
      orderDirection: 'desc',
      orderField: 'approveTime',
    });
  });
});
