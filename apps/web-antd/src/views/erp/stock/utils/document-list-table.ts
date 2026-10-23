import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDate, formatDateTime } from '@vben/utils';

import { stockNatural as erpCountTableColumnFormatter } from '#/views/erp/stock/utils/stock-decimal';

import { stockListNumber } from './stock-decimal';

type StockListColumn = NonNullable<VxeTableGridOptions['columns']>[number];

export interface PrepareStockDocumentListColumnsOptions {
  baseWidths?: Record<string, number>;
  trailingFlexibleColumnMinWidth?: number;
}

type CustomizedStockListColumn = StockListColumn & {
  renderFixed?: StockListColumn['fixed'];
  renderVisible?: boolean;
  resizeWidth?: number | string;
};

const TEXT_WIDTH_PADDING = 28;
const SORTABLE_WIDTH_PADDING = 12;

const FIXED_FIELD_WIDTHS: Record<string, number> = {
  actions: 132,
  approveAction: 48,
  continueBuyAction: 62,
  deleteAction: 40,
  exportAction: 40,
  printAction: 48,
  priority: 90,
};

const FUNCTION_COLUMN_FIELDS = new Set([
  'actions',
  'approveAction',
  'continueBuyAction',
  'deleteAction',
  'exportAction',
  'printAction',
]);

const BASE_FIELD_WIDTHS: Record<string, number> = {
  actualCount: 72,
  approveTime: 160,
  approveUserName: 72,
  balanceType: 76,
  checkTime: 106,
  checkType: 84,
  count: 64,
  createTime: 106,
  creatorName: 72,
  customerName: 96,
  deptName: 80,
  fromDeptName: 88,
  fromWarehouseName: 92,
  fromWarehouseNames: 96,
  handlerName: 72,
  inTime: 106,
  itemCount: 52,
  lastPrintTime: 106,
  looseQty: 64,
  moveTime: 106,
  no: 90,
  outTime: 106,
  pickedCount: 72,
  printCount: 72,
  printTime: 160,
  productCodes: 86,
  productNames: 96,
  remark: 90,
  remainingCount: 72,
  sourceNo: 90,
  status: 64,
  supplierName: 96,
  toDeptName: 88,
  toWarehouseName: 92,
  toWarehouseNames: 96,
  totalCount: 72,
  totalPrice: 84,
  totalWeight: 72,
  transferInNo: 100,
  transferOutNo: 100,
  updateTime: 106,
  updaterName: 72,
  warehouseNames: 96,
  wholeQty: 64,
};

const AMOUNT_FIELDS = new Set(['totalAmount', 'totalPrice']);

const COUNT_FIELDS = new Set([
  'actualCount',
  'count',
  'itemCount',
  'looseQty',
  'pickedCount',
  'remainingCount',
  'totalCount',
  'totalWeight',
  'wholeQty',
]);

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
  column: StockListColumn,
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

function formatCellValue(column: StockListColumn, row: Record<string, any>) {
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
  column: StockListColumn,
  options: PrepareStockDocumentListColumnsOptions,
) {
  const field = String(column.field ?? '');
  const overrideWidth = options.baseWidths?.[field];
  if (overrideWidth !== undefined) return overrideWidth;
  if (BASE_FIELD_WIDTHS[field] !== undefined) return BASE_FIELD_WIDTHS[field];
  if (typeof column.width === 'number') return column.width;
  if (typeof column.minWidth === 'number') return column.minWidth;
  return 72;
}

function shouldKeepFixedWidth(column: StockListColumn) {
  const field = String(column.field ?? '');
  return Boolean(column.type || FIXED_FIELD_WIDTHS[field] !== undefined);
}

function isOperationColumn(column: StockListColumn) {
  return (
    column.field === 'actions' ||
    column.field === 'operation' ||
    column.slots?.default === 'actions'
  );
}

function isFlexibleDataColumn(column: StockListColumn) {
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

function makeTrailingDataColumnFlexible<T extends StockListColumn>(
  columns: T[],
  minimumWidth: number,
) {
  const targetIndex = columns.findLastIndex((value) =>
    isFlexibleDataColumn(value),
  );
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

function getColumnCustomizationKey(column: StockListColumn) {
  if (column.field) return `field:${String(column.field)}`;
  if (column.type) return `type:${String(column.type)}`;
  return undefined;
}

/**
 * Reapply VXE's runtime column settings before selecting the trailing flexible
 * data column. Permission-filtered columns remain authoritative while saved
 * order, visibility, width and fixed state continue to be respected.
 */
export function applyStockDocumentListColumnCustomization<
  T extends StockListColumn,
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
    const customizedColumn = column as CustomizedStockListColumn;
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
  const operationColumns = normalizedColumns.filter((value) =>
    isOperationColumn(value),
  );
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
  column: StockListColumn,
  rows: Array<Record<string, any>>,
  options: PrepareStockDocumentListColumnsOptions,
) {
  const field = String(column.field ?? '');
  if (shouldKeepFixedWidth(column)) {
    return column.width ?? FIXED_FIELD_WIDTHS[field] ?? column.minWidth;
  }

  const titleWidth =
    measureTextWidth(column.title ?? field) +
    TEXT_WIDTH_PADDING +
    (column.sortable ? SORTABLE_WIDTH_PADDING : 0);
  let rowWidth = 0;

  for (const row of rows) {
    const displayValue = formatCellValue(column, row);
    rowWidth = Math.max(
      rowWidth,
      measureTextWidth(displayValue) +
        TEXT_WIDTH_PADDING +
        (column.sortable ? SORTABLE_WIDTH_PADDING : 0),
    );
  }

  return Math.max(getColumnBaseWidth(column, options), titleWidth, rowWidth);
}

export function prepareStockDocumentListColumns<
  T extends Record<string, any> = Record<string, any>,
>(
  columns: NonNullable<VxeTableGridOptions['columns']>,
  rows: T[] = [],
  options: PrepareStockDocumentListColumnsOptions = {},
): NonNullable<VxeTableGridOptions['columns']> {
  const decimalFields = new Set([
    'actualCount',
    'costAmount',
    'costPrice',
    'count',
    'creditControl',
    'looseQty',
    'pickedCount',
    'productPrice',
    'purchasePrice',
    'remainCount',
    'remainingCount',
    'stockCount',
    'totalAmount',
    'totalCostAmount',
    'totalCount',
    'totalPrice',
    'totalWeight',
    'truckagePrice',
    'warehousePrice',
    'weight',
    'wholeQty',
  ]);
  const preparedColumns = columns.map((originalColumn) => {
    const column = { ...originalColumn };
    if (decimalFields.has(String(column.field))) {
      const originalFormatter = column.formatter;
      column.formatter = (args: any) => {
        const previous =
          typeof originalFormatter === 'function'
            ? originalFormatter(args)
            : undefined;
        return previous === '****' ? previous : stockListNumber(args.cellValue);
      };
    }
    const { minWidth: _minWidth, ...restColumn } = column as StockListColumn;
    return {
      ...restColumn,
      width: resolveColumnWidth(column as StockListColumn, rows, options),
    };
  });
  const { trailingFlexibleColumnMinWidth } = options;
  if (trailingFlexibleColumnMinWidth === undefined) return preparedColumns;
  return makeTrailingDataColumnFlexible(
    preparedColumns,
    trailingFlexibleColumnMinWidth,
  );
}
