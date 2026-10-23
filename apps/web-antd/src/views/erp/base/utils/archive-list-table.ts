import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  erpCountTableColumnFormatter,
  formatDate,
  formatDateTime,
} from '@vben/utils';

type ArchiveColumn = NonNullable<VxeTableGridOptions['columns']>[number] & {
  dataIndex?: string;
  ellipsis?: boolean;
};

export interface PrepareErpArchiveListColumnsOptions {
  baseWidths?: Record<string, number>;
}

export interface PrepareErpArchiveItemColumnsOptions {
  editable?: boolean;
  isCellEditable?: (field: string, row: Record<string, any>) => boolean;
  rows?: Record<string, any>[];
}

const TEXT_WIDTH_PADDING = 30;
const SORTABLE_WIDTH_PADDING = 12;
const EDITABLE_CONTROL_EXTRA = 18;
const SELECT_CONTROL_EXTRA = 38;

const FIXED_FIELD_WIDTHS: Record<string, number> = {
  actions: 132,
  contactAction: 78,
  contactListAction: 78,
  enterpriseMatch: 86,
  enterpriseMatchStatusAction: 86,
  operation: 132,
  supplierPortalAction: 98,
};

const BASE_FIELD_WIDTHS: Record<string, number> = {
  accountName: 96,
  accountSetName: 96,
  address: 96,
  areaName: 72,
  bankName: 96,
  barCode: 92,
  brand: 72,
  cardNo: 120,
  categoryName: 88,
  code: 82,
  contactInfo: 86,
  contractDate: 106,
  createTime: 160,
  creator: 72,
  creatorName: 72,
  currentStock: 78,
  customerTypeName: 88,
  defaulted: 56,
  detailAddress: 96,
  disabledByName: 78,
  disabledTime: 160,
  email: 110,
  endTime: 106,
  factoryCode: 88,
  flags: 90,
  id: 58,
  latitude: 72,
  longitude: 72,
  mapName: 84,
  mobile: 86,
  name: 96,
  position: 72,
  priceLevelName: 88,
  purchaser: 72,
  readonlyBySaleDistribution: 112,
  region: 72,
  remark: 90,
  routeName: 72,
  saleUserName: 86,
  settleMethodName: 98,
  sort: 52,
  sourceType: 68,
  startTime: 106,
  standard: 72,
  status: 64,
  telephone: 86,
  unitName: 52,
  updateTime: 160,
  updaterName: 72,
  vehicleModel: 92,
  warehouseType: 82,
  wechat: 86,
};

const NUMBER_FIELDS = new Set([
  'baseAmount',
  'costAmount',
  'costPrice',
  'count',
  'creditLimit',
  'currentStock',
  'lockCount',
  'occupiedCount',
  'referencePrice',
  'retailPrice',
  'sharePrice',
  'sort',
  'taskAmount',
]);

const COUNT_FIELDS = new Set(['month', 'sort', 'year']);

const SELECT_CONTROL_PLACEHOLDERS: Record<string, string> = {
  accountSetId: '请选择关联账套',
  areaId: '请选择区域',
  categoryId: '请选择分类',
  customerTypeId: '请选择客户类型',
  deptId: '请选择部门',
  purchaserId: '请选择采购员',
  routeId: '请选择线路',
  saleUserId: '请选择业务员',
  settleMethodId: '请选择结算方式',
  unitId: '请选择单位',
  warehouseId: '请选择仓库',
};

function getField(column: ArchiveColumn) {
  const dataIndex = Array.isArray(column.dataIndex)
    ? column.dataIndex.join('.')
    : column.dataIndex;
  return String(column.field ?? dataIndex ?? '');
}

function isBlank(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function measureTextWidth(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return 0;

  let width = 0;
  for (const char of text) {
    if (/[\u2E80-\u9FFF\uF900-\uFAFF]/u.test(char)) {
      width += 14;
    } else if (/[A-Z0-9]/u.test(char)) {
      width += 8;
    } else if (/[a-z]/u.test(char)) {
      width += 7.2;
    } else if (char === ' ') {
      width += 4;
    } else {
      width += 5;
    }
  }
  return Math.ceil(width);
}

function trimTrailingZeros(value: string) {
  if (!value.includes('.')) return value;
  return value.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
}

function formatNumber(value: unknown) {
  if (isBlank(value)) return '';
  const numberValue =
    typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(numberValue)) return value;
  return trimTrailingZeros(numberValue.toFixed(2));
}

function formatCount(value: unknown) {
  if (isBlank(value)) return '';
  const numberValue =
    typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(numberValue)) return value;
  return erpCountTableColumnFormatter(numberValue);
}

function runFunctionFormatter(
  column: ArchiveColumn,
  row: Record<string, any>,
  cellValue: unknown,
) {
  if (typeof column.formatter !== 'function') return undefined;
  try {
    return column.formatter({ cellValue, column, row } as any);
  } catch {
    return undefined;
  }
}

function getRawValue(row: Record<string, any>, field: string) {
  if (!field.includes('.')) return row[field];
  return field.split('.').reduce((value, key) => value?.[key], row);
}

function getDisplayValue(row: Record<string, any>, field: string) {
  const directValue = getRawValue(row, field);
  if (!field.endsWith('Id')) return directValue;

  const nameField = `${field.slice(0, -2)}Name`;
  return row[nameField] ?? directValue;
}

function formatCellValue(column: ArchiveColumn, row: Record<string, any>) {
  const field = getField(column);
  const value = getDisplayValue(row, field);
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
    NUMBER_FIELDS.has(field)
  ) {
    return formatNumber(value);
  }
  return value;
}

function isOperationColumn(column: ArchiveColumn) {
  const field = getField(column);
  return (
    field === 'actions' ||
    field === 'operation' ||
    column.slots?.default === 'actions'
  );
}

function shouldKeepFixedWidth(column: ArchiveColumn) {
  const field = getField(column);
  return Boolean(
    column.type ||
    isOperationColumn(column) ||
    FIXED_FIELD_WIDTHS[field] !== undefined ||
    field.endsWith('Action'),
  );
}

function getColumnBaseWidth(
  column: ArchiveColumn,
  options: PrepareErpArchiveListColumnsOptions,
) {
  const field = getField(column);
  const overrideWidth = options.baseWidths?.[field];
  if (overrideWidth !== undefined) return overrideWidth;
  if (BASE_FIELD_WIDTHS[field] !== undefined) return BASE_FIELD_WIDTHS[field];
  if (typeof column.width === 'number') return column.width;
  if (typeof column.minWidth === 'number') return column.minWidth;
  return 72;
}

function resolveListColumnWidth(
  column: ArchiveColumn,
  rows: Array<Record<string, any>>,
  options: PrepareErpArchiveListColumnsOptions,
) {
  const field = getField(column);
  if (shouldKeepFixedWidth(column)) {
    return column.width ?? FIXED_FIELD_WIDTHS[field] ?? column.minWidth ?? 64;
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

function resolveItemColumnWidth(
  column: ArchiveColumn,
  options: PrepareErpArchiveItemColumnsOptions,
) {
  const field = getField(column);
  const declaredWidth = Number(column.width ?? column.minWidth ?? 0);
  const minWidth = BASE_FIELD_WIDTHS[field] ?? declaredWidth;
  const titleWidth = measureTextWidth(column.title ?? field);
  const { editable = false, isCellEditable, rows = [] } = options;
  const hasRows = rows.length > 0;
  let hasEditableCell = editable && !hasRows;
  let rowWidth = 0;

  for (const row of rows) {
    const rowEditable = editable && (isCellEditable?.(field, row) ?? true);
    hasEditableCell ||= rowEditable;
    const rawValue = formatCellValue(column, row);
    const displayValue =
      rowEditable && isBlank(rawValue) && SELECT_CONTROL_PLACEHOLDERS[field]
        ? SELECT_CONTROL_PLACEHOLDERS[field]
        : rawValue;
    rowWidth = Math.max(rowWidth, measureTextWidth(displayValue));
  }

  const controlExtra =
    hasEditableCell && SELECT_CONTROL_PLACEHOLDERS[field]
      ? SELECT_CONTROL_EXTRA
      : hasEditableCell
        ? EDITABLE_CONTROL_EXTRA
        : 0;

  return Math.ceil(
    Math.max(
      minWidth,
      titleWidth + TEXT_WIDTH_PADDING,
      rowWidth + TEXT_WIDTH_PADDING + controlExtra,
    ),
  );
}

export function prepareErpArchiveListColumns<
  T extends Record<string, any> = Record<string, any>,
>(
  columns: NonNullable<VxeTableGridOptions['columns']>,
  rows: T[] = [],
  options: PrepareErpArchiveListColumnsOptions = {},
): NonNullable<VxeTableGridOptions['columns']> {
  return columns.map((column) => {
    const { minWidth: _minWidth, ...restColumn } = column as ArchiveColumn;
    return {
      ...restColumn,
      width: resolveListColumnWidth(column as ArchiveColumn, rows, options),
    };
  });
}

export function prepareErpArchiveItemColumns<T extends object>(
  columns: T[] = [],
  options: PrepareErpArchiveItemColumnsOptions = {},
): T[] {
  return columns.map((column) => {
    const next = { ...column } as ArchiveColumn & T;
    const field = getField(next);
    if ('ellipsis' in next) {
      delete next.ellipsis;
    }
    if (shouldKeepFixedWidth(next) || !field) {
      next.width = Number(next.width ?? next.minWidth ?? 64);
      delete next.minWidth;
      return next as T;
    }
    delete next.fixed;
    next.width = resolveItemColumnWidth(next, options);
    delete next.minWidth;
    return next as T;
  });
}
