import { financeMoney } from './finance-decimal';
type ItemColumn = {
  dataIndex?: string;
  ellipsis?: boolean;
  field?: string;
  fixed?: any;
  formatter?: any;
  minWidth?: number | string;
  slots?: any;
  sortable?: boolean;
  title?: unknown;
  type?: any;
  visible?: boolean;
  width?: number | string;
};

export type PrepareFinanceDocumentItemColumnOptions = {
  editable?: boolean;
  isCellEditable?: (field: string, row: Record<string, any>) => boolean;
  rows?: Record<string, any>[];
  trailingFlexibleColumnMinWidth?: number;
};

type CustomizedItemColumn = ItemColumn & {
  renderFixed?: any;
  renderVisible?: boolean;
  resizeWidth?: number | string;
};

const CONTENT_WIDTH_EXTRA = 34;
const EDITABLE_CONTROL_EXTRA = 18;
const SELECT_CONTROL_EXTRA = 38;

const SELECT_CONTROL_PLACEHOLDERS: Record<string, string> = {
  accountId: '请选择结算账户',
  customerId: '请选择对象',
  deptId: '请选择部门',
  financeUserId: '请选择经办人',
  handlerId: '请选择经手人',
  itemName: '请选择项目名称',
  settleMethod: '请选择结算方式',
  supplierId: '请选择对象',
};
const SELECT_CONTROL_FIELDS = new Set(Object.keys(SELECT_CONTROL_PLACEHOLDERS));

const EDITABLE_CONTROL_FIELDS = new Set([
  'amount',
  'bizDate',
  'customerId',
  'expenseCategory',
  'fileUrl',
  'freightType',
  'invoiceNo',
  'itemName',
  'party',
  'paymentPrice',
  'qty',
  'receiptPrice',
  'remark',
]);

const COMPACT_NUMBER_FIELDS = new Set([
  'amount',
  'balance',
  'paidPrice',
  'paymentAmount',
  'paymentPrice',
  'qty',
  'receiptAmount',
  'receiptedPrice',
  'receiptPrice',
  'totalAmount',
  'totalPrice',
  'unPaymentPrice',
  'unReceiptedPrice',
]);

const TEXT_FIELD_MIN_WIDTHS: Record<string, number> = {
  accountName: 96,
  amount: 72,
  balance: 72,
  bizDate: 106,
  bizNo: 120,
  customerId: 110,
  customerName: 110,
  deptId: 96,
  deptName: 90,
  expenseCategory: 88,
  fileUrl: 96,
  financeUserName: 80,
  freightType: 86,
  handlerId: 96,
  handlerName: 80,
  invoiceNo: 88,
  itemName: 110,
  no: 100,
  paidPrice: 86,
  party: 90,
  paymentAmount: 84,
  paymentMethod: 86,
  paymentPrice: 94,
  paymentTime: 160,
  qty: 52,
  receiptAmount: 84,
  receiptMethod: 86,
  receiptedPrice: 86,
  receiptPrice: 94,
  receiptTime: 160,
  remark: 90,
  reverseReason: 90,
  supplierName: 110,
  totalAmount: 84,
  totalPrice: 84,
  transactionTime: 160,
  unPaymentPrice: 90,
  unReceiptedPrice: 90,
  writeOffStatus: 78,
  writeOffTime: 160,
};

function getField(column: ItemColumn) {
  return column.field ?? column.dataIndex ?? '';
}

function isBlank(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function isOperationColumn(column: ItemColumn) {
  const field = getField(column);
  return (
    field === 'actions' ||
    field === 'operation' ||
    column.slots?.default === 'actions'
  );
}

function makeTrailingBusinessColumnFlexible<T extends ItemColumn>(
  columns: T[],
  minimumWidth: number,
) {
  let targetIndex = -1;
  for (let index = columns.length - 1; index >= 0; index--) {
    const column = columns[index];
    if (
      column?.field &&
      column.visible !== false &&
      !isOperationColumn(column)
    ) {
      targetIndex = index;
      break;
    }
  }
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
  flexibleColumns[targetIndex] = flexibleColumn;
  return flexibleColumns;
}

function getColumnCustomizationKey(column: ItemColumn) {
  const field = getField(column);
  if (field) return `field:${field}`;
  if (column.type) return `type:${String(column.type)}`;
  return undefined;
}

/**
 * Reapplies VXE Table's runtime column settings before choosing the flexible
 * trailing business column. This keeps the rule correct after users hide,
 * reorder, resize, or fix columns in the native column-settings panel.
 */
export function applyFinanceDocumentItemColumnCustomization<T extends object>(
  preparedColumns: T[] = [],
  customizedColumns: object[] = [],
  trailingFlexibleColumnMinWidth = 150,
): T[] {
  if (customizedColumns.length === 0) return preparedColumns;

  const preparedByKey = new Map<string, ItemColumn & T>();
  preparedColumns.forEach((column) => {
    const preparedColumn = column as ItemColumn & T;
    const key = getColumnCustomizationKey(preparedColumn);
    if (key) preparedByKey.set(key, preparedColumn);
  });

  const appliedKeys = new Set<string>();
  const mergedColumns: (ItemColumn & T)[] = [];
  customizedColumns.forEach((column) => {
    const customizedColumn = column as CustomizedItemColumn;
    const key = getColumnCustomizationKey(customizedColumn);
    const preparedColumn = key ? preparedByKey.get(key) : undefined;
    if (!key || !preparedColumn || appliedKeys.has(key)) return;

    appliedKeys.add(key);
    const mergedColumn = { ...preparedColumn } as ItemColumn & T;
    mergedColumn.visible = isOperationColumn(mergedColumn)
      ? preparedColumn.visible
      : (customizedColumn.visible ?? customizedColumn.renderVisible);

    if (!isOperationColumn(mergedColumn)) {
      const fixed = customizedColumn.fixed ?? customizedColumn.renderFixed;
      if (fixed) mergedColumn.fixed = fixed;
      else delete mergedColumn.fixed;
    }

    const resizedWidth = Number(customizedColumn.resizeWidth ?? 0);
    if (Number.isFinite(resizedWidth) && resizedWidth > 0) {
      mergedColumn.width = resizedWidth;
      delete mergedColumn.minWidth;
    }
    mergedColumns.push(mergedColumn);
  });

  preparedColumns.forEach((column) => {
    const preparedColumn = column as ItemColumn & T;
    const key = getColumnCustomizationKey(preparedColumn);
    if (!key || !appliedKeys.has(key)) mergedColumns.push(preparedColumn);
  });

  const normalizedColumns = mergedColumns.map((column) => {
    if (!column.field || isOperationColumn(column)) return column;
    const normalizedColumn = { ...column };
    const width = Number(
      normalizedColumn.width ?? normalizedColumn.minWidth ?? 0,
    );
    if (Number.isFinite(width) && width > 0) normalizedColumn.width = width;
    delete normalizedColumn.minWidth;
    return normalizedColumn;
  });

  return makeTrailingBusinessColumnFlexible(
    normalizedColumns,
    trailingFlexibleColumnMinWidth,
  ) as T[];
}

function measureTextWidth(value: unknown) {
  const text = String(value ?? '');
  let width = 0;
  for (const char of text) {
    if (/[\u2E80-\u9FFF\uF900-\uFAFF]/.test(char)) {
      width += 13;
    } else if (/[A-Z0-9]/.test(char)) {
      width += 8;
    } else {
      width += 7;
    }
  }
  return width;
}

function trimTrailingZeros(value: string) {
  if (!value.includes('.')) {
    return value;
  }
  return value.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
}

function formatCompactNumberDisplayValue(field: string, value: unknown) {
  if (!COMPACT_NUMBER_FIELDS.has(field) || isBlank(value)) {
    return value;
  }
  return financeMoney(value as any);
}

function getItemColumnDisplayValue(row: Record<string, any>, field: string) {
  switch (field) {
    case 'accountId': {
      return row.accountName ?? row.accountId;
    }
    case 'customerId': {
      return row.customerName ?? row.customerId;
    }
    case 'deptId': {
      return row.deptName ?? row.deptId;
    }
    case 'financeUserId':
    case 'handlerId': {
      return row.handlerName ?? row.financeUserName ?? row.handlerId;
    }
    case 'supplierId': {
      return row.supplierName ?? row.supplierId;
    }
    default: {
      return formatCompactNumberDisplayValue(field, row[field]);
    }
  }
}

function isEditableControlColumn(column: ItemColumn) {
  const field = getField(column);
  return Boolean(field && EDITABLE_CONTROL_FIELDS.has(field));
}

function resolveEditableControlValue(field: string, value: unknown) {
  if (isBlank(value) && SELECT_CONTROL_FIELDS.has(field)) {
    return SELECT_CONTROL_PLACEHOLDERS[field];
  }
  return value;
}

function resolveContentWidth(
  column: ItemColumn,
  options: PrepareFinanceDocumentItemColumnOptions = {},
) {
  const field = getField(column);
  if (!field) {
    return Number(column.width ?? column.minWidth ?? 0);
  }
  const { editable = false, isCellEditable, rows = [] } = options;
  const declaredWidth = Number(column.width ?? column.minWidth ?? 0);
  const minWidth = TEXT_FIELD_MIN_WIDTHS[field] ?? declaredWidth;
  const titleWidth = measureTextWidth(column.title ?? field);
  const hasRows = rows.length > 0;
  let hasEditableCell = editable && !hasRows;
  let rowWidth = 0;
  for (const row of rows) {
    const rowEditable = editable && (isCellEditable?.(field, row) ?? true);
    hasEditableCell ||= rowEditable;
    const value = getItemColumnDisplayValue(row, field);
    const displayValue = rowEditable
      ? resolveEditableControlValue(field, value)
      : value;
    rowWidth = Math.max(rowWidth, measureTextWidth(displayValue));
  }
  let controlExtra = 0;
  if (hasEditableCell && SELECT_CONTROL_FIELDS.has(field)) {
    rowWidth = Math.max(
      rowWidth,
      measureTextWidth(SELECT_CONTROL_PLACEHOLDERS[field]),
    );
    controlExtra = SELECT_CONTROL_EXTRA;
  } else if (hasEditableCell && isEditableControlColumn(column)) {
    controlExtra = EDITABLE_CONTROL_EXTRA;
  }
  return Math.ceil(
    Math.max(
      minWidth,
      titleWidth + CONTENT_WIDTH_EXTRA,
      rowWidth + CONTENT_WIDTH_EXTRA + controlExtra,
    ),
  );
}

export function prepareFinanceDocumentItemColumns<T extends object>(
  columns: T[] = [],
  options: PrepareFinanceDocumentItemColumnOptions = {},
): T[] {
  const preparedColumns = columns.map((column) => {
    const next = { ...column } as ItemColumn & T;
    const field = getField(next);
    if (isOperationColumn(next)) {
      next.fixed = 'right';
      next.sortable = false;
      next.width = Math.max(Number(next.width) || 0, 64);
      return next as T;
    }
    if ('ellipsis' in next) {
      delete next.ellipsis;
    }
    if (next.type === 'checkbox') {
      next.sortable = false;
      next.width = Number(next.width ?? next.minWidth ?? 44);
      delete next.minWidth;
      return next as T;
    }
    if (next.type === 'seq' || !field) {
      next.sortable = false;
      next.width = Number(next.width ?? next.minWidth ?? 50);
      delete next.minWidth;
      return next as T;
    }
    delete next.fixed;
    if ('field' in next) {
      next.sortable = next.sortable ?? true;
    }
    next.width = resolveContentWidth(next, options);
    delete next.minWidth;
    return next as T;
  });
  const { trailingFlexibleColumnMinWidth } = options;
  if (trailingFlexibleColumnMinWidth === undefined) {
    return preparedColumns;
  }
  return makeTrailingBusinessColumnFlexible(
    preparedColumns,
    trailingFlexibleColumnMinWidth,
  );
}

/**
 * Expands the final visible business column to the measured table container.
 * Fixed utility columns still contribute to the total width, but never absorb
 * the remaining space. When the container is narrower than the content, the
 * declared minimum widths are kept so VXE Table exposes horizontal scrolling.
 */
export function fitFinanceDocumentItemColumnsToWidth<T extends ItemColumn>(
  columns: T[] = [],
  availableWidth = 0,
): T[] {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return columns;
  const targetIndex = columns.findLastIndex(
    (column) =>
      column.visible !== false &&
      Boolean(getField(column)) &&
      !isOperationColumn(column) &&
      column.type !== 'checkbox' &&
      column.type !== 'seq' &&
      !column.fixed,
  );
  if (targetIndex < 0) return columns;
  const target = columns[targetIndex];
  if (!target) return columns;
  const minimum = Number(target.width ?? target.minWidth ?? 0);
  const otherWidth = columns.reduce((sum, column, index) => {
    if (index === targetIndex || column.visible === false) return sum;
    const width = Number(column.width ?? column.minWidth ?? 0);
    return sum + (Number.isFinite(width) ? width : 0);
  }, 0);
  const fittedWidth = Math.max(
    Number.isFinite(minimum) ? minimum : 0,
    Math.floor(availableWidth - otherWidth),
  );
  const fitted = [...columns];
  fitted[targetIndex] = {
    ...target,
    minWidth: fittedWidth,
    width: fittedWidth,
  } as T;
  return fitted;
}
