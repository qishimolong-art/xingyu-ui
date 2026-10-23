import { nextTick } from 'vue';

import { queueAfterEditableControlRender } from './keyboard';

export type ErpItemRowFocusField = 'count' | 'product';

type ItemRowGrid<Row> = {
  scrollToRow?: (row: Row) => unknown;
  setCurrentRow?: (row: Row) => unknown;
};

type ItemRowFocusControllerOptions<Row> = {
  focusField: (row: Row, field: ErpItemRowFocusField) => boolean;
  getAllRows: () => Row[];
  getDisplayedRows: () => Row[];
  getGrid: () => ItemRowGrid<Row> | null | undefined;
  getLocalPage: () => { pageNo: number; pageSize: number };
  getRowKey: (row?: Row) => string | undefined;
  isDisabled: () => boolean;
  isRemotePaging: () => boolean;
  refreshGrid: () => Promise<unknown>;
  setActiveRow?: (row: Row) => void;
  setLocalPageNo: (pageNo: number) => void;
};

function isFocusableInput(input: HTMLInputElement) {
  return (
    !input.disabled &&
    !input.readOnly &&
    input.getAttribute('aria-disabled') !== 'true' &&
    input.tabIndex >= 0
  );
}

export function focusEditableInputByRowKey(
  scope: null | ParentNode | undefined,
  selector: string,
  rowKey: string | undefined,
  rowKeyAttribute = 'data-erp-item-row-key',
) {
  if (!scope || !rowKey) {
    return false;
  }
  const input = [...scope.querySelectorAll<HTMLInputElement>(selector)].find(
    (candidate) =>
      candidate.getAttribute(rowKeyAttribute) === rowKey &&
      isFocusableInput(candidate),
  );
  if (!input) {
    return false;
  }
  input.focus({ preventScroll: true });
  try {
    input.select();
  } catch {
    // Some input types can receive focus but do not support text selection.
  }
  return true;
}

export function createErpItemRowFocusController<Row>(
  options: ItemRowFocusControllerOptions<Row>,
) {
  let focusRequestId = 0;

  function locateLocalPage(rowKey: string) {
    if (options.isRemotePaging()) {
      return true;
    }
    const { pageNo: originalPageNo, pageSize } = options.getLocalPage();
    const pageCount = Math.max(
      1,
      Math.ceil(options.getAllRows().length / Math.max(1, pageSize)),
    );
    for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
      options.setLocalPageNo(pageNo);
      if (
        options
          .getDisplayedRows()
          .some((row) => options.getRowKey(row) === rowKey)
      ) {
        return true;
      }
    }
    options.setLocalPageNo(originalPageNo);
    return false;
  }

  async function focus(row: Row, field: ErpItemRowFocusField) {
    if (options.isDisabled()) {
      return false;
    }
    const rowKey = options.getRowKey(row);
    if (!rowKey || !locateLocalPage(rowKey)) {
      return false;
    }
    const requestId = ++focusRequestId;
    options.setActiveRow?.(row);
    await options.refreshGrid();
    if (requestId !== focusRequestId) {
      return false;
    }
    await nextTick();
    queueAfterEditableControlRender(() => {
      if (requestId !== focusRequestId || options.isDisabled()) {
        return;
      }
      const displayedRow = options
        .getDisplayedRows()
        .find((item) => options.getRowKey(item) === rowKey);
      if (!displayedRow) {
        return;
      }
      options.setActiveRow?.(displayedRow);
      const grid = options.getGrid();
      grid?.setCurrentRow?.(displayedRow);
      void grid?.scrollToRow?.(displayedRow);
      options.focusField(displayedRow, field);
    });
    return true;
  }

  function cancel() {
    focusRequestId += 1;
  }

  return { cancel, focus };
}
