import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createErpItemRowFocusController,
  focusEditableInputByRowKey,
} from './item-row-focus';

describe('ERP item row focus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  it('focuses the editable input that belongs to the requested row', () => {
    const scope = document.createElement('div');
    scope.innerHTML = `
      <input data-count="true" data-erp-item-row-key="row-1" />
      <input data-count="true" data-erp-item-row-key="row-2" />
    `;
    document.body.append(scope);

    expect(
      focusEditableInputByRowKey(scope, '[data-count="true"]', 'row-2'),
    ).toBe(true);
    expect(document.activeElement).toBe(scope.querySelectorAll('input')[1]);
  });

  it('moves to the sorted local page and synchronizes current row before focusing', async () => {
    const rows = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    const page = { pageNo: 1, pageSize: 2 };
    const setCurrentRow = vi.fn();
    const scrollToRow = vi.fn();
    const scope = document.createElement('div');
    scope.innerHTML = `
      <input data-count="true" data-erp-item-row-key="a" />
      <input data-count="true" data-erp-item-row-key="b" />
      <input data-count="true" data-erp-item-row-key="c" />
    `;
    document.body.append(scope);
    const focusField = vi.fn((row: { key: string }) =>
      focusEditableInputByRowKey(scope, '[data-count="true"]', row.key),
    );
    const controller = createErpItemRowFocusController({
      focusField,
      getAllRows: () => rows,
      getDisplayedRows: () =>
        rows
          .toReversed()
          .slice(
            (page.pageNo - 1) * page.pageSize,
            page.pageNo * page.pageSize,
          ),
      getGrid: () => ({ scrollToRow, setCurrentRow }),
      getLocalPage: () => page,
      getRowKey: (row) => row?.key,
      isDisabled: () => false,
      isRemotePaging: () => false,
      refreshGrid: async () => undefined,
      setLocalPageNo: (pageNo) => {
        page.pageNo = pageNo;
      },
    });

    const [firstRow] = rows;
    expect(firstRow).toBeDefined();
    await controller.focus(firstRow as { key: string }, 'count');

    expect(page.pageNo).toBe(2);
    expect(setCurrentRow).toHaveBeenCalledWith(rows[0]);
    expect(scrollToRow).toHaveBeenCalledWith(rows[0]);
    expect(focusField).toHaveBeenCalledWith(rows[0], 'count');
    expect(document.activeElement).toBe(scope.querySelector('input'));
  });

  it('keeps only the newest delayed focus request', async () => {
    const rows = [{ key: 'a' }, { key: 'b' }];
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const focusField = vi.fn(() => true);
    const controller = createErpItemRowFocusController({
      focusField,
      getAllRows: () => rows,
      getDisplayedRows: () => rows,
      getGrid: () => undefined,
      getLocalPage: () => ({ pageNo: 1, pageSize: 10 }),
      getRowKey: (row) => row?.key,
      isDisabled: () => false,
      isRemotePaging: () => false,
      refreshGrid: async () => undefined,
      setLocalPageNo: () => undefined,
    });

    const [firstRow, secondRow] = rows;
    expect(firstRow).toBeDefined();
    expect(secondRow).toBeDefined();
    await controller.focus(firstRow as { key: string }, 'count');
    await controller.focus(secondRow as { key: string }, 'count');
    while (callbacks.length > 0) {
      callbacks.shift()?.(0);
    }

    expect(focusField).toHaveBeenCalledTimes(1);
    expect(focusField).toHaveBeenCalledWith(rows[1], 'count');
  });

  it('focuses the matching rendered row in remote paging without changing local pages', async () => {
    const requestedRow = { key: 'remote-new-row' };
    const renderedRow = { key: 'remote-new-row' };
    const focusField = vi.fn(() => true);
    const setLocalPageNo = vi.fn();
    const setCurrentRow = vi.fn();
    const scrollToRow = vi.fn();
    const controller = createErpItemRowFocusController({
      focusField,
      getAllRows: () => [requestedRow],
      getDisplayedRows: () => [renderedRow],
      getGrid: () => ({ scrollToRow, setCurrentRow }),
      getLocalPage: () => ({ pageNo: 1, pageSize: 10 }),
      getRowKey: (row) => row?.key,
      isDisabled: () => false,
      isRemotePaging: () => true,
      refreshGrid: async () => undefined,
      setLocalPageNo,
    });

    await controller.focus(requestedRow, 'product');

    expect(setLocalPageNo).not.toHaveBeenCalled();
    expect(setCurrentRow).toHaveBeenCalledWith(renderedRow);
    expect(scrollToRow).toHaveBeenCalledWith(renderedRow);
    expect(focusField).toHaveBeenCalledWith(renderedRow, 'product');
  });
});
