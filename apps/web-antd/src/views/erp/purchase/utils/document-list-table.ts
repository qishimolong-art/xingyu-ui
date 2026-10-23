import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDate, formatDateTime } from '@vben/utils';

type PurchaseListColumn = NonNullable<VxeTableGridOptions['columns']>[number];

export interface PreparePurchaseDocumentListColumnsOptions {
  baseWidths?: Record<string, number>;
  trailingFlexibleColumnMinWidth?: number;
}

type CustomizedPurchaseListColumn = PurchaseListColumn & {
  renderFixed?: PurchaseListColumn['fixed'];
  renderVisible?: boolean;
  resizeWidth?: number | string;
};

const TEXT_WIDTH_PADDING = 28;
const SORTABLE_WIDTH_PADDING = 12;

const FIXED_FIELD_WIDTHS: Record<string, number> = {
  actions: 110,
  continueBuyAction: 62,
  deleteAction: 40,
  depositAction: 72,
  exportAction: 40,
  inAction: 40,
  printAction: 40,
  printFrequency: 72,
  wechatNotifyAction: 62,
};

const FUNCTION_COLUMN_FIELDS = new Set([
  'actions',
  'continueBuyAction',
  'deleteAction',
  'depositAction',
  'exportAction',
  'inAction',
  'printAction',
  'wechatNotifyAction',
]);

const BASE_FIELD_WIDTHS: Record<string, number> = {
  adjustStatus: 76,
  adjustType: 88,
  adjusterName: 72,
  approveTime: 106,
  approverName: 72,
  auditTime: 160,
  auditUserName: 72,
  createTime: 160,
  creatorName: 72,
  deptName: 80,
  displayTaxPercent: 64,
  factoryOrderNo: 86,
  inStatus: 72,
  invoiceDate: 106,
  invoiceNo: 90,
  invoiceStatus: 76,
  invoiceType: 88,
  itemCount: 52,
  no: 90,
  orderDate: 160,
  orderNo: 86,
  paymentStatus: 72,
  purchaser: 72,
  purchaserName: 72,
  remark: 90,
  returnStatus: 76,
  returnTime: 160,
  settlementStatus: 84,
  status: 64,
  supplierName: 96,
  supplierType: 96,
  transferOutStatus: 76,
  updateTime: 106,
  updaterName: 72,
};

const AMOUNT_FIELDS = new Set([
  'adjustedTotalPrice',
  'depositPrice',
  'discountPrice',
  'feeAmount',
  'originalTotalPrice',
  'paymentPrice',
  'taxAmount',
  'taxExclusiveAmount',
  'totalAdjustPrice',
  'totalAmount',
  'totalPrice',
  'totalProductPrice',
]);

const COUNT_FIELDS = new Set(['itemCount', 'totalCount']);

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

  return formatNumber(numberValue);
}

function runFunctionFormatter(
  column: PurchaseListColumn,
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

function formatCellValue(column: PurchaseListColumn, row: Record<string, any>) {
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

  if (column.formatter === 'formatAmount3') {
    return formatCount(value);
  }

  if (
    column.formatter === 'formatAmount2' ||
    column.formatter === 'formatAmount' ||
    AMOUNT_FIELDS.has(field)
  ) {
    return formatNumber(value);
  }

  if (COUNT_FIELDS.has(field)) {
    return formatCount(value);
  }

  return value;
}

function getColumnBaseWidth(
  column: PurchaseListColumn,
  options: PreparePurchaseDocumentListColumnsOptions,
) {
  const field = String(column.field ?? '');
  const overrideWidth = options.baseWidths?.[field];
  if (overrideWidth !== undefined) return overrideWidth;
  if (BASE_FIELD_WIDTHS[field] !== undefined) return BASE_FIELD_WIDTHS[field];
  if (typeof column.width === 'number') return column.width;
  if (typeof column.minWidth === 'number') return column.minWidth;
  return 72;
}

function shouldKeepFixedWidth(column: PurchaseListColumn) {
  const field = String(column.field ?? '');
  return Boolean(column.type || FIXED_FIELD_WIDTHS[field] !== undefined);
}

function isOperationColumn(column: PurchaseListColumn) {
  return (
    column.field === 'actions' ||
    column.field === 'operation' ||
    column.slots?.default === 'actions'
  );
}

function isFlexibleDataColumn(column: PurchaseListColumn) {
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

function makeTrailingDataColumnFlexible<T extends PurchaseListColumn>(
  columns: T[],
  minimumWidth: number,
) {
  const targetIndex = columns.findLastIndex((column) =>
    isFlexibleDataColumn(column),
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

function getColumnCustomizationKey(column: PurchaseListColumn) {
  if (column.field) return `field:${String(column.field)}`;
  if (column.type) return `type:${String(column.type)}`;
  return undefined;
}

/**
 * Reapply the native VXE column settings before selecting the trailing flexible
 * data column. Permission-filtered columns remain authoritative, while saved
 * order, visibility, width and fixed state continue to be respected.
 */
export function applyPurchaseDocumentListColumnCustomization<
  T extends PurchaseListColumn,
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
    const customizedColumn = column as CustomizedPurchaseListColumn;
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
      // A detail page declares its operation column unavailable. Persisted
      // settings must never bring that column (or its blank reserved width)
      // back, while list/create/edit operation columns remain mandatory.
      mergedColumn.visible = preparedColumn.visible !== false;
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
      const key = getColumnCustomizationKey(normalizedColumn);
      normalizedColumn.visible = key
        ? preparedByKey.get(key)?.visible !== false
        : normalizedColumn.visible !== false;
      return normalizedColumn;
    }
    const width = Number(
      normalizedColumn.width ?? normalizedColumn.minWidth ?? 0,
    );
    if (Number.isFinite(width) && width > 0) normalizedColumn.width = width;
    delete normalizedColumn.minWidth;
    return normalizedColumn;
  });
  const operationColumns = normalizedColumns.filter((column) =>
    isOperationColumn(column),
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

/**
 * VXE restores a persisted drag width as `resizeWidth`. A resized trailing
 * business column is then excluded from the table's native `fit` calculation,
 * which leaves a blank strip before a right-fixed operation column on wide
 * screens. Release only that runtime resize value: its measured `minWidth`
 * remains the narrow-screen floor, while VXE can give it the wide-screen
 * remainder again. The persisted user preference is left untouched and is
 * reapplied to all other columns.
 */
export function releasePurchaseDocumentTrailingColumnResize(
  columns: object[] = [],
) {
  const target = columns.findLast((column) => {
    const runtimeColumn = column as CustomizedPurchaseListColumn;
    const visible = runtimeColumn.renderVisible ?? runtimeColumn.visible;
    const fixed = runtimeColumn.renderFixed ?? runtimeColumn.fixed;
    return isFlexibleDataColumn({
      ...runtimeColumn,
      fixed,
      visible,
    });
  }) as CustomizedPurchaseListColumn | undefined;

  if (!target || !target.resizeWidth) return false;
  target.resizeWidth = 0;
  return true;
}

/** Keep the mode-owned operation column authoritative after VXE restores its
 * persisted fixed/visible state. List/create/edit keep it on the right; detail
 * keeps it fully hidden so no blank fixed-column space is reserved. */
export function enforcePurchaseDocumentOperationColumn(
  runtimeColumns: object[] = [],
  configuredColumns: object[] = [],
) {
  const runtimeOperation = runtimeColumns.find((column) =>
    isOperationColumn(column as PurchaseListColumn),
  ) as CustomizedPurchaseListColumn | undefined;
  const configuredOperation = configuredColumns.find((column) =>
    isOperationColumn(column as PurchaseListColumn),
  ) as CustomizedPurchaseListColumn | undefined;
  if (!runtimeOperation || !configuredOperation) return false;

  const visible = configuredOperation.visible !== false;
  runtimeOperation.fixed = 'right';
  runtimeOperation.renderFixed = 'right';
  runtimeOperation.visible = visible;
  runtimeOperation.renderVisible = visible;
  return true;
}

export async function syncPurchaseDocumentOperationColumn(
  table: any,
  configuredColumns: object[] = [],
) {
  const runtimeColumns = table?.getFullColumns?.() ?? [];
  const runtimeOperation = runtimeColumns.find((column: object) =>
    isOperationColumn(column as PurchaseListColumn),
  ) as CustomizedPurchaseListColumn | undefined;
  const configuredOperation = configuredColumns.find((column) =>
    isOperationColumn(column as PurchaseListColumn),
  ) as CustomizedPurchaseListColumn | undefined;
  if (!runtimeOperation || !configuredOperation) return false;

  if (configuredOperation.visible === false) {
    await table.hideColumn?.(runtimeOperation);
  } else {
    await table.showColumn?.(runtimeOperation);
    await table.setColumnFixed?.(runtimeOperation, 'right');
  }
  enforcePurchaseDocumentOperationColumn(runtimeColumns, configuredColumns);
  return true;
}

/** Preserve permission-filtered page definitions as VXE's reset baseline even
 * when the live columns were rebuilt from saved visibility/order/width state. */
export function syncPurchaseDocumentColumnDefaults(
  runtimeColumns: object[] = [],
  defaultColumns: object[] = [],
) {
  const defaultsByKey = new Map<string, CustomizedPurchaseListColumn>();
  defaultColumns.forEach((column) => {
    const typedColumn = column as CustomizedPurchaseListColumn;
    const key = getColumnCustomizationKey(typedColumn);
    if (key) defaultsByKey.set(key, typedColumn);
  });

  let changed = false;
  runtimeColumns.forEach((column) => {
    const runtimeColumn = column as CustomizedPurchaseListColumn & {
      defaultFixed?: PurchaseListColumn['fixed'];
      defaultVisible?: boolean;
    };
    const key = getColumnCustomizationKey(runtimeColumn);
    const defaultColumn = key ? defaultsByKey.get(key) : undefined;
    if (!defaultColumn) return;
    runtimeColumn.defaultVisible = defaultColumn.visible !== false;
    runtimeColumn.defaultFixed = defaultColumn.fixed;
    changed = true;
  });
  return changed;
}

/**
 * Give the trailing visible business column exactly the remaining table width.
 * The fixed operation column is included in `otherWidth`, so the business cell
 * stops at (rather than underneath) the right-fixed overlay. When the viewport
 * is narrower than the measured columns, keep the measured minimum and let VXE
 * expose its horizontal scrollbar.
 */
export function fitPurchaseDocumentColumnsToWidth<T extends PurchaseListColumn>(
  columns: T[] = [],
  availableWidth = 0,
): T[] {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return columns;

  const targetIndex = columns.findLastIndex((column) =>
    isFlexibleDataColumn(column),
  );
  if (targetIndex === -1) return columns;
  const target = columns[targetIndex];
  if (!target) return columns;

  const targetMinimum = Number(target.width ?? target.minWidth ?? 0);
  let otherWidth = 0;
  for (const [index, column] of columns.entries()) {
    if (index === targetIndex || column.visible === false) continue;
    const width = Number(column.width ?? column.minWidth ?? 0);
    if (Number.isFinite(width)) otherWidth += width;
  }
  const fittedWidth = Math.max(
    Number.isFinite(targetMinimum) ? targetMinimum : 0,
    Math.floor(availableWidth - otherWidth),
  );
  const fittedColumns = [...columns];
  fittedColumns[targetIndex] = {
    ...target,
    minWidth: fittedWidth,
    width: fittedWidth,
  } as T;
  return fittedColumns;
}

function resolveColumnWidth(
  column: PurchaseListColumn,
  rows: Array<Record<string, any>>,
  options: PreparePurchaseDocumentListColumnsOptions,
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

export function preparePurchaseDocumentListColumns<
  T extends Record<string, any> = Record<string, any>,
>(
  columns: NonNullable<VxeTableGridOptions['columns']>,
  rows: T[] = [],
  options: PreparePurchaseDocumentListColumnsOptions = {},
): NonNullable<VxeTableGridOptions['columns']> {
  const preparedColumns = columns.map((column) => {
    const { minWidth: _minWidth, ...restColumn } = column as PurchaseListColumn;
    return {
      ...restColumn,
      width: resolveColumnWidth(column as PurchaseListColumn, rows, options),
    };
  });
  const { trailingFlexibleColumnMinWidth } = options;
  if (trailingFlexibleColumnMinWidth === undefined) return preparedColumns;
  return makeTrailingDataColumnFlexible(
    preparedColumns,
    trailingFlexibleColumnMinWidth,
  );
}
