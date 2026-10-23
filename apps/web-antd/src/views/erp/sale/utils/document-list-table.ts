import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  erpCountTableColumnFormatter,
  formatDate,
  formatDateTime,
} from '@vben/utils';

type SaleListColumn = NonNullable<VxeTableGridOptions['columns']>[number];

export interface PrepareSaleDocumentListColumnsOptions {
  baseWidths?: Record<string, number>;
  trailingFlexibleColumnMinWidth?: number;
}

type CustomizedSaleListColumn = SaleListColumn & {
  renderFixed?: SaleListColumn['fixed'];
  renderVisible?: boolean;
  resizeWidth?: number | string;
};

const TEXT_WIDTH_PADDING = 28;
const SORTABLE_WIDTH_PADDING = 12;

const FIXED_FIELD_WIDTHS: Record<string, number> = {
  actions: 130,
  cloudPrintAction: 60,
  continueBuyAction: 62,
  deleteAction: 40,
  emailAction: 44,
  exportAction: 40,
  expenseAction: 52,
  printAction: 40,
  quoteAction: 54,
  signAction: 40,
  wechatNotifyAction: 62,
};

const BASE_FIELD_WIDTHS: Record<string, number> = {
  adjustDate: 106,
  adjustStatus: 72,
  adjustUserName: 72,
  afterCancelAmount: 90,
  afterReductionAmount: 86,
  approveTime: 160,
  auditorName: 72,
  billAmount: 78,
  billNo: 86,
  billType: 78,
  cancelAmount: 78,
  cancelCount: 72,
  cartTime: 160,
  confirmTime: 160,
  convertedCartStatus: 100,
  createTime: 160,
  creatorName: 72,
  customerCode: 86,
  customerName: 96,
  deliveryAddress: 110,
  deliveryMethod: 78,
  deliveryNo: 86,
  deptName: 80,
  discountPrice: 78,
  feeAmount: 60,
  freight: 60,
  freightType: 78,
  handlerName: 72,
  invoiceType: 78,
  logisticsCompany: 88,
  logisticsNo: 86,
  no: 90,
  orderMethod: 78,
  orderTime: 106,
  orderType: 78,
  outCount: 68,
  outTime: 160,
  printCount: 64,
  printTime: 160,
  priority: 64,
  productNames: 110,
  quoteTime: 160,
  receiverName: 72,
  receiverPhone: 100,
  reductionAmount: 78,
  remark: 90,
  remark2: 90,
  returnCount: 68,
  returnMode: 86,
  returnStatus: 72,
  returnTime: 160,
  saleUserName: 72,
  settleMethod: 78,
  settleStatus: 76,
  settlementStatus: 84,
  sourceCreateTime: 160,
  sourceCreatorName: 96,
  sourceNo: 90,
  status: 64,
  taxExclusiveAdjustPrice: 108,
  taxPrice: 60,
  totalAdjustedPrice: 84,
  totalAdjustPrice: 84,
  totalCount: 60,
  totalOriginalPrice: 84,
  totalPrice: 78,
  totalProductPrice: 78,
  totalWeight: 64,
  updateTime: 160,
  updaterName: 72,
  vehiclePlateNo: 72,
  vin: 120,
};

const AMOUNT_FIELDS = new Set([
  'afterCancelAmount',
  'afterReductionAmount',
  'billAmount',
  'cancelAmount',
  'discountPrice',
  'feeAmount',
  'freight',
  'taxExclusiveAdjustPrice',
  'taxPrice',
  'totalAdjustedPrice',
  'totalAdjustPrice',
  'totalOriginalPrice',
  'totalPrice',
  'totalProductPrice',
]);

const COUNT_FIELDS = new Set([
  'cancelCount',
  'outCount',
  'printCount',
  'returnCount',
  'totalCount',
  'totalWeight',
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
  column: SaleListColumn,
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

function formatCellValue(column: SaleListColumn, row: Record<string, any>) {
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
  column: SaleListColumn,
  options: PrepareSaleDocumentListColumnsOptions,
) {
  const field = String(column.field ?? '');
  const overrideWidth = options.baseWidths?.[field];
  if (overrideWidth !== undefined) return overrideWidth;
  if (BASE_FIELD_WIDTHS[field] !== undefined) return BASE_FIELD_WIDTHS[field];
  if (typeof column.width === 'number') return column.width;
  if (typeof column.minWidth === 'number') return column.minWidth;
  return 72;
}

function shouldKeepFixedWidth(column: SaleListColumn) {
  const field = String(column.field ?? '');
  return Boolean(column.type || FIXED_FIELD_WIDTHS[field] !== undefined);
}

function isOperationColumn(column: SaleListColumn) {
  return (
    column.field === 'actions' ||
    column.field === 'operation' ||
    column.slots?.default === 'actions'
  );
}

function isFlexibleDataColumn(column: SaleListColumn) {
  return Boolean(
    column.field &&
    column.visible !== false &&
    !column.type &&
    !column.fixed &&
    !isOperationColumn(column),
  );
}

function makeTrailingDataColumnFlexible<T extends SaleListColumn>(
  columns: T[],
  minimumWidth: number,
) {
  const targetIndex = columns.findLastIndex(isFlexibleDataColumn);
  if (targetIndex === -1) return columns;
  const target = columns[targetIndex];
  if (!target) return columns;

  const currentWidth = Number(target.width ?? target.minWidth ?? 0);
  const flexibleColumn = { ...target };
  delete flexibleColumn.width;
  flexibleColumn.minWidth = Math.max(
    Number.isFinite(currentWidth) ? currentWidth : 0,
    minimumWidth,
  );
  const nextColumns = [...columns];
  nextColumns[targetIndex] = flexibleColumn as T;
  return nextColumns;
}

function getColumnCustomizationKey(column: SaleListColumn) {
  if (column.field) return `field:${String(column.field)}`;
  if (column.type) return `type:${String(column.type)}`;
  return undefined;
}

/**
 * Reapply VXE's saved order, visibility and widths before choosing the single
 * trailing flexible business column. The operation column remains owned by
 * the page and cannot be hidden, moved away from the end or unfixed.
 */
export function applySaleDocumentListColumnCustomization<
  T extends SaleListColumn,
>(
  preparedColumns: T[] = [],
  customizedColumns: object[] = [],
  trailingFlexibleColumnMinWidth = 0,
): T[] {
  if (customizedColumns.length === 0) return preparedColumns;

  const preparedByKey = new Map<string, T>();
  for (const column of preparedColumns) {
    const key = getColumnCustomizationKey(column);
    if (key) preparedByKey.set(key, column);
  }

  const appliedKeys = new Set<string>();
  const mergedColumns: T[] = [];
  for (const column of customizedColumns) {
    const customized = column as CustomizedSaleListColumn;
    const key = getColumnCustomizationKey(customized);
    const prepared = key ? preparedByKey.get(key) : undefined;
    if (!key || !prepared || appliedKeys.has(key)) continue;
    appliedKeys.add(key);

    const merged = { ...prepared } as T;
    if (isOperationColumn(merged)) {
      merged.fixed = 'right';
      merged.visible = prepared.visible !== false;
    } else {
      const visible = customized.visible ?? customized.renderVisible;
      if (visible !== undefined) merged.visible = visible;
      const fixed = customized.fixed ?? customized.renderFixed;
      if (fixed) merged.fixed = fixed;
      else delete merged.fixed;
      const resizedWidth = Number(customized.resizeWidth ?? 0);
      if (Number.isFinite(resizedWidth) && resizedWidth > 0) {
        merged.width = resizedWidth;
        delete merged.minWidth;
      }
    }
    mergedColumns.push(merged);
  }

  for (const column of preparedColumns) {
    const key = getColumnCustomizationKey(column);
    if (!key || !appliedKeys.has(key)) mergedColumns.push(column);
  }

  const normalized = mergedColumns.map((column) => {
    const next = { ...column } as T;
    if (isOperationColumn(next)) {
      next.fixed = 'right';
      next.visible = true;
      return next;
    }
    const width = Number(next.width ?? next.minWidth ?? 0);
    if (Number.isFinite(width) && width > 0) next.width = width;
    delete next.minWidth;
    return next;
  });
  const operations = normalized.filter(isOperationColumn);
  const businessColumns = normalized.filter(
    (column) => !isOperationColumn(column),
  );
  return [
    ...makeTrailingDataColumnFlexible(
      businessColumns,
      trailingFlexibleColumnMinWidth,
    ),
    ...operations,
  ];
}

export function syncSaleDocumentColumnDefaults(
  runtimeColumns: object[] = [],
  defaultColumns: object[] = [],
) {
  const defaults = new Map<string, CustomizedSaleListColumn>();
  for (const column of defaultColumns) {
    const typed = column as CustomizedSaleListColumn;
    const key = getColumnCustomizationKey(typed);
    if (key) defaults.set(key, typed);
  }
  for (const column of runtimeColumns) {
    const runtime = column as CustomizedSaleListColumn & {
      defaultFixed?: SaleListColumn['fixed'];
      defaultVisible?: boolean;
    };
    const key = getColumnCustomizationKey(runtime);
    const defaultColumn = key ? defaults.get(key) : undefined;
    if (!defaultColumn) continue;
    runtime.defaultVisible = defaultColumn.visible !== false;
    runtime.defaultFixed = defaultColumn.fixed;
  }
}

export async function syncSaleDocumentOperationColumn(
  table: any,
  configuredColumns: object[] = [],
) {
  const runtime = (table?.getFullColumns?.() ?? []).find((column: object) =>
    isOperationColumn(column as SaleListColumn),
  ) as CustomizedSaleListColumn | undefined;
  const configured = configuredColumns.find((column) =>
    isOperationColumn(column as SaleListColumn),
  ) as CustomizedSaleListColumn | undefined;
  if (!runtime || !configured) return;
  if (configured.visible === false) await table.hideColumn?.(runtime);
  else {
    await table.showColumn?.(runtime);
    await table.setColumnFixed?.(runtime, 'right');
  }
  runtime.fixed = 'right';
  runtime.renderFixed = 'right';
  runtime.visible = configured.visible !== false;
  runtime.renderVisible = configured.visible !== false;
}

function resolveColumnWidth(
  column: SaleListColumn,
  rows: Array<Record<string, any>>,
  options: PrepareSaleDocumentListColumnsOptions,
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

export function prepareSaleDocumentListColumns<
  T extends Record<string, any> = Record<string, any>,
>(
  columns: NonNullable<VxeTableGridOptions['columns']>,
  rows: T[] = [],
  options: PrepareSaleDocumentListColumnsOptions = {},
): NonNullable<VxeTableGridOptions['columns']> {
  const preparedColumns = columns.map((column) => {
    const { minWidth: _minWidth, ...restColumn } = column as SaleListColumn;
    return {
      ...restColumn,
      width: resolveColumnWidth(column as SaleListColumn, rows, options),
    };
  });
  const { trailingFlexibleColumnMinWidth } = options;
  return trailingFlexibleColumnMinWidth === undefined
    ? preparedColumns
    : makeTrailingDataColumnFlexible(
        preparedColumns,
        trailingFlexibleColumnMinWidth,
      );
}
