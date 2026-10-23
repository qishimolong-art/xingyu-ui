import { financeListMoney } from './finance-decimal';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { erpCountTableColumnFormatter,
  formatDate,
  formatDateTime } from '@vben/utils';

type FinanceListColumn = NonNullable<VxeTableGridOptions['columns']>[number];

export interface PrepareFinanceDocumentListColumnsOptions {
  baseWidths?: Record<string, number>;
  trailingFlexibleColumnMinWidth?: number;
}

type CustomizedFinanceListColumn = FinanceListColumn & {
  renderFixed?: FinanceListColumn['fixed'];
  renderVisible?: boolean;
  resizeWidth?: number | string;
};

const TEXT_WIDTH_PADDING = 28;
const SORTABLE_WIDTH_PADDING = 12;

const FIXED_FIELD_WIDTHS: Record<string, number> = {
  actions: 168,
  deleteAction: 40,
  exportAction: 40,
  printAction: 40,
};

const FUNCTION_COLUMN_FIELDS = new Set([
  'actions',
  'deleteAction',
  'exportAction',
  'printAction',
]);

const BASE_FIELD_WIDTHS: Record<string, number> = {
  accountName: 88,
  accountType: 84,
  allocatedPrice: 92,
  auditTime: 160,
  auditorName: 72,
  balance: 84,
  bankAccount: 96,
  bankName: 88,
  bizNo: 90,
  bizTime: 106,
  createTime: 160,
  creatorName: 72,
  customerName: 96,
  defaultStatus: 78,
  deptName: 80,
  discountPrice: 84,
  documentStatus: 78,
  expenseBizType: 88,
  expenseType: 88,
  financeUserName: 72,
  handlerName: 72,
  incomeType: 88,
  itemCount: 52,
  name: 96,
  no: 90,
  party: 86,
  payableAmount: 84,
  paymentPrice: 84,
  paymentTime: 106,
  project: 80,
  receiptPrice: 84,
  receiptTime: 106,
  receivableAmount: 84,
  relatedBiz: 90,
  remark: 90,
  settleMethod: 88,
  settledAmount: 84,
  sort: 52,
  sourceNo: 90,
  sourceType: 76,
  status: 64,
  supplierName: 96,
  totalAmount: 84,
  totalPrice: 84,
  transactionTime: 160,
  unallocatedPrice: 92,
  updateTime: 160,
  updaterName: 72,
  voucherNo: 88,
  writeOffStatus: 78,
};

const AMOUNT_FIELDS = new Set([
  'allocatedPrice',
  'balance',
  'currentBalance',
  'discountPrice',
  'increasePayableAmount',
  'increaseReceivableAmount',
  'miscPayableAmount',
  'miscReceivableAmount',
  'payableAmount',
  'paymentAmount',
  'paymentPrice',
  'purchaseInAmount',
  'receiptAmount',
  'receiptPrice',
  'receivableAmount',
  'saleOutAmount',
  'settledAmount',
  'totalAmount',
  'totalPrice',
  'unallocatedPrice',
]);

const COUNT_FIELDS = new Set(['itemCount', 'sort']);

function measureTextWidth(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return 0;

  let width = 0;
  for (const char of text) {
    if (/[\u4E00-\u9FFF]/.test(char)) {
      width += 14;
      continue;
    }
    if (/[A-Z]/.test(char)) {
      width += 7.6;
      continue;
    }
    if (/[a-z0-9]/.test(char)) {
      width += 7.2;
      continue;
    }
    if (char === ' ') {
      width += 4;
      continue;
    }
    width += 4.8;
  }
  return Math.ceil(width);
}

function formatNumber(value: unknown, digits = 2) {
  if (value === undefined || value === null || value === '') return '';

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return value;

  return numberValue.toFixed(digits);
}

function formatCount(value: unknown) {
  if (value === undefined || value === null || value === '') return '';

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return value;

  return erpCountTableColumnFormatter(numberValue);
}

function runFunctionFormatter(
  column: FinanceListColumn,
  row: Record<string, any>,
  cellValue: unknown,
) {
  const formatter = column.formatter;
  if (typeof formatter !== 'function') return undefined;

  try {
    return formatter({ cellValue, column, row } as any);
  } catch {
    return undefined;
  }
}

function formatCellValue(column: FinanceListColumn, row: Record<string, any>) {
  const field = String(column.field ?? '');
  const value = row[field];
  const formattedValue = runFunctionFormatter(column, row, value);
  if (formattedValue !== undefined) return formattedValue;

  if (column.formatter === 'formatDateTime') {
    return value ? formatDateTime(value as any) || String(value) : '';
  }

  if (column.formatter === 'formatDate') {
    return value ? formatDate(value as any) || String(value) : '';
  }

  if (column.formatter === 'formatAmount3' || COUNT_FIELDS.has(field)) {
    return formatCount(value);
  }

  if (
    column.formatter === 'formatAmount2' ||
    column.formatter === 'formatAmount' ||
    AMOUNT_FIELDS.has(field)
  ) {
    return formatNumber(value);
  }

  return value;
}

function getColumnBaseWidth(
  column: FinanceListColumn,
  options: PrepareFinanceDocumentListColumnsOptions,
) {
  const field = String(column.field ?? '');
  const overrideWidth = options.baseWidths?.[field];
  if (overrideWidth !== undefined) return overrideWidth;
  if (BASE_FIELD_WIDTHS[field] !== undefined) return BASE_FIELD_WIDTHS[field];
  if (typeof column.width === 'number') return column.width;
  if (typeof column.minWidth === 'number') return column.minWidth;
  return 72;
}

function shouldKeepFixedWidth(column: FinanceListColumn) {
  const field = String(column.field ?? '');
  return Boolean(column.type || FIXED_FIELD_WIDTHS[field] !== undefined);
}

function isOperationColumn(column: FinanceListColumn) {
  return (
    column.field === 'actions' ||
    column.field === 'operation' ||
    column.slots?.default === 'actions'
  );
}

function isFlexibleDataColumn(column: FinanceListColumn) {
  const field = String(column.field ?? '');
  return Boolean(
    field &&
    column.visible !== false &&
    !column.type &&
    !column.fixed &&
    !FUNCTION_COLUMN_FIELDS.has(field) &&
    !isOperationColumn(column),
  );
}

function makeTrailingDataColumnFlexible<T extends FinanceListColumn>(
  columns: T[],
  minimumWidth: number,
) {
  const targetIndex = columns.findLastIndex(isFlexibleDataColumn);
  if (targetIndex === -1) return columns;

  const targetColumn = columns[targetIndex];
  if (!targetColumn) return columns;

  const currentWidth = Number(targetColumn.width ?? targetColumn.minWidth ?? 0);
  const flexibleColumn = { ...targetColumn };
  delete flexibleColumn.width;
  flexibleColumn.minWidth = Math.max(
    Number.isFinite(currentWidth) ? currentWidth : 0,
    minimumWidth,
  );

  const flexibleColumns = [...columns];
  flexibleColumns[targetIndex] = flexibleColumn as T;
  return flexibleColumns;
}

function getColumnCustomizationKey(column: FinanceListColumn) {
  if (column.field) return `field:${String(column.field)}`;
  if (column.type) return `type:${String(column.type)}`;
  return undefined;
}

/**
 * Reapply VXE's runtime column settings before selecting the trailing flexible
 * data column. Permission-filtered columns remain authoritative while saved
 * order, visibility, width and fixed state continue to be respected.
 */
export function applyFinanceDocumentListColumnCustomization<
  T extends FinanceListColumn,
>(
  preparedColumns: T[] = [],
  customizedColumns: object[] = [],
  trailingFlexibleColumnMinWidth = 0,
): T[] {
  if (customizedColumns.length === 0) return preparedColumns;

  const preparedByKey = new Map<string, T>();
  preparedColumns.forEach((column) => {
    const key = getColumnCustomizationKey(column);
    if (key) preparedByKey.set(key, column);
  });

  const appliedKeys = new Set<string>();
  const mergedColumns: T[] = [];
  customizedColumns.forEach((column) => {
    const customizedColumn = column as CustomizedFinanceListColumn;
    const key = getColumnCustomizationKey(customizedColumn);
    const preparedColumn = key ? preparedByKey.get(key) : undefined;
    if (!key || !preparedColumn || appliedKeys.has(key)) return;

    appliedKeys.add(key);
    const mergedColumn = { ...preparedColumn } as T;
    const runtimeVisible =
      customizedColumn.visible ?? customizedColumn.renderVisible;
    if (runtimeVisible !== undefined) mergedColumn.visible = runtimeVisible;

    if (isOperationColumn(mergedColumn)) {
      mergedColumn.fixed = 'right';
    } else {
      const runtimeFixed =
        customizedColumn.fixed ?? customizedColumn.renderFixed;
      if (runtimeFixed) mergedColumn.fixed = runtimeFixed;
      else delete mergedColumn.fixed;

      const resizedWidth = Number(customizedColumn.resizeWidth ?? 0);
      if (Number.isFinite(resizedWidth) && resizedWidth > 0) {
        mergedColumn.width = resizedWidth;
        delete mergedColumn.minWidth;
      }
    }
    mergedColumns.push(mergedColumn);
  });

  preparedColumns.forEach((column) => {
    const key = getColumnCustomizationKey(column);
    if (!key || !appliedKeys.has(key)) mergedColumns.push(column);
  });

  const normalizedColumns = mergedColumns.map((column) => {
    const normalizedColumn = { ...column } as T;
    if (isOperationColumn(normalizedColumn)) {
      normalizedColumn.fixed = 'right';
      return normalizedColumn;
    }
    const width = Number(
      normalizedColumn.width ?? normalizedColumn.minWidth ?? 0,
    );
    if (Number.isFinite(width) && width > 0) normalizedColumn.width = width;
    delete normalizedColumn.minWidth;
    return normalizedColumn;
  });
  const operationColumns = normalizedColumns.filter(isOperationColumn);
  const nonOperationColumns = normalizedColumns.filter(
    (column) => !isOperationColumn(column),
  );

  return [
    ...makeTrailingDataColumnFlexible(
      nonOperationColumns,
      trailingFlexibleColumnMinWidth,
    ),
    ...operationColumns,
  ];
}

function resolveColumnWidth(
  column: FinanceListColumn,
  rows: Array<Record<string, any>>,
  options: PrepareFinanceDocumentListColumnsOptions,
) {
  const field = String(column.field ?? '');
  if (shouldKeepFixedWidth(column)) {
    return column.width ?? FIXED_FIELD_WIDTHS[field] ?? column.minWidth;
  }

  const sortablePadding = column.sortable ? SORTABLE_WIDTH_PADDING : 0;
  const titleWidth =
    measureTextWidth(column.title ?? field) +
    TEXT_WIDTH_PADDING +
    sortablePadding;
  let rowWidth = 0;

  for (const row of rows) {
    rowWidth = Math.max(
      rowWidth,
      measureTextWidth(formatCellValue(column, row)) +
        TEXT_WIDTH_PADDING +
        sortablePadding,
    );
  }

  return Math.max(getColumnBaseWidth(column, options), titleWidth, rowWidth);
}

export function prepareFinanceDocumentListColumns<
  T extends Record<string, any> = Record<string, any>,
>(
  columns: NonNullable<VxeTableGridOptions['columns']>,
  rows: T[] = [],
  options: PrepareFinanceDocumentListColumnsOptions = {},
): NonNullable<VxeTableGridOptions['columns']> {
  const preparedColumns = columns.map((column) => {
    const { minWidth: _minWidth, ...restColumn } = column as FinanceListColumn;
    if (/(?:Price|Amount|Balance)$|^(amount|balance)$/.test(String(column.field ?? '')) && !column.slots) {
      restColumn.formatter = ({ cellValue }: any) => financeListMoney(cellValue);
    }
    return {
      ...restColumn,
      width: resolveColumnWidth(column as FinanceListColumn, rows, options),
    };
  });
  const { trailingFlexibleColumnMinWidth } = options;
  if (trailingFlexibleColumnMinWidth === undefined) return preparedColumns;
  return makeTrailingDataColumnFlexible(
    preparedColumns,
    trailingFlexibleColumnMinWidth,
  );
}

/** Fit the trailing visible business column to the real container width. */
export function fitFinanceDocumentListColumnsToWidth<
  T extends FinanceListColumn,
>(columns: T[] = [], availableWidth = 0): T[] {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return columns;
  const targetIndex = columns.findLastIndex(isFlexibleDataColumn);
  if (targetIndex === -1) return columns;
  const target = columns[targetIndex];
  if (!target) return columns;

  const targetMinimum = Number(target.width ?? target.minWidth ?? 0);
  const otherWidth = columns.reduce((sum, column, index) => {
    if (index === targetIndex || column.visible === false) return sum;
    const width = Number(column.width ?? column.minWidth ?? 0);
    return sum + (Number.isFinite(width) ? width : 0);
  }, 0);
  const fittedWidth = Math.max(
    Number.isFinite(targetMinimum) ? targetMinimum : 0,
    Math.floor(availableWidth - otherWidth),
  );
  const result = [...columns];
  result[targetIndex] = {
    ...target,
    minWidth: fittedWidth,
    width: fittedWidth,
  } as T;
  return result;
}
