type ItemColumn = {
  dataIndex?: string;
  ellipsis?: boolean;
  field?: string;
  fixed?: '' | 'left' | 'right' | boolean | null;
  minWidth?: number | string;
  slots?: { default?: unknown };
  sortable?: boolean;
  title?: string;
  type?: null | string;
  visible?: boolean;
  width?: number | string;
};

type CustomizedItemColumn = ItemColumn & {
  renderFixed?: any;
  renderVisible?: boolean;
  resizeWidth?: number | string;
};

type PrepareItemColumnOptions = {
  editable?: boolean;
  isCellEditable?: (field: string, row: Record<string, any>) => boolean;
  rows?: Record<string, any>[];
  trailingFlexibleColumnMinWidth?: number;
};

const CONTENT_WIDTH_EXTRA = 34;
const COMPACT_CONTENT_WIDTH_EXTRA = 22;
const EDITABLE_CONTROL_EXTRA = 18;
const SELECT_CONTROL_EXTRA = 38;

const SELECT_CONTROL_PLACEHOLDERS: Record<string, string> = {
  fromWarehouseId: '请选择调出仓库',
  toWarehouseId: '请选择调入仓库',
  warehouseId: '请选择仓库',
};
const SELECT_CONTROL_FIELDS = new Set(Object.keys(SELECT_CONTROL_PLACEHOLDERS));

const EDITABLE_CONTROL_FIELDS = new Set([
  'actualCount',
  'batchNo',
  'count',
  'productPrice',
  'remark',
  'totalPrice',
  'warehousePosition',
]);

const COMPACT_NUMBER_FIELDS = new Set([
  'actualCount',
  'count',
  'looseQty',
  'packageQty',
  'pickedCount',
  'pieceCount',
  'productPrice',
  'remainCount',
  'stockCount',
  'totalCount',
  'totalPrice',
  'totalWeight',
  'weight',
  'wholeQty',
]);

const PRICE_FIXED_WIDTH_FIELDS = new Set(['productPrice', 'totalPrice']);
const PRODUCT_NAME_FIELDS = new Set(['partName', 'productId', 'productName']);

const TEXT_FIELD_MIN_WIDTHS: Record<string, number> = {
  actualCount: 72,
  batchNo: 72,
  brand: 58,
  count: 54,
  fromWarehouseDeptName: 96,
  fromWarehouseId: 96,
  fromWarehouseName: 96,
  looseQty: 60,
  originPlace: 58,
  packageQty: 56,
  pickedCount: 72,
  pieceCount: 56,
  productBarCode: 78,
  productCode: 82,
  productId: 160,
  productName: 160,
  productPrice: 64,
  productUnitName: 50,
  remainCount: 72,
  remark: 90,
  status: 64,
  stockCount: 54,
  toWarehouseDeptName: 96,
  toWarehouseId: 96,
  toWarehouseName: 96,
  totalCount: 72,
  totalPrice: 78,
  totalWeight: 72,
  vehicleModel: 86,
  warehouseDeptName: 96,
  warehouseId: 88,
  warehouseName: 88,
  warehousePosition: 72,
  weight: 56,
  wholeQty: 60,
};

function getField(column: ItemColumn) {
  return column.field ?? column.dataIndex ?? '';
}

function getContentWidthExtra(field: string) {
  return COMPACT_NUMBER_FIELDS.has(field)
    ? COMPACT_CONTENT_WIDTH_EXTRA
    : CONTENT_WIDTH_EXTRA;
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

function prioritizeProductNameColumn<T extends ItemColumn>(columns: T[]) {
  const productNameIndex = columns.findIndex((column) =>
    PRODUCT_NAME_FIELDS.has(getField(column)),
  );
  if (productNameIndex === -1) return columns;

  const prioritizedColumns = [...columns];
  const [productNameColumn] = prioritizedColumns.splice(productNameIndex, 1);
  if (!productNameColumn) return columns;

  const firstBusinessColumnIndex = prioritizedColumns.findIndex(
    (column) => column.type !== 'checkbox' && column.type !== 'seq',
  );
  prioritizedColumns.splice(
    firstBusinessColumnIndex === -1
      ? prioritizedColumns.length
      : firstBusinessColumnIndex,
    0,
    productNameColumn,
  );
  return prioritizedColumns;
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
 * Reapply VXE Table's runtime column settings before selecting the trailing
 * flexible business column. This keeps the rule correct after users hide,
 * reorder, resize, or fix columns in the native column-settings panel.
 */
export function applyStockDocumentItemColumnCustomization<T extends ItemColumn>(
  preparedColumns: T[] = [],
  customizedColumns: object[] = [],
  trailingFlexibleColumnMinWidth = 150,
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
    const customizedColumn = column as CustomizedItemColumn;
    const key = getColumnCustomizationKey(customizedColumn);
    const preparedColumn = key ? preparedByKey.get(key) : undefined;
    if (!key || !preparedColumn || appliedKeys.has(key)) return;

    appliedKeys.add(key);
    const mergedColumn = { ...preparedColumn } as T;
    mergedColumn.visible =
      customizedColumn.visible ?? customizedColumn.renderVisible;

    if (!isOperationColumn(mergedColumn)) {
      const fixed = customizedColumn.fixed ?? customizedColumn.renderFixed;
      if (fixed) {
        mergedColumn.fixed = fixed;
      } else {
        delete mergedColumn.fixed;
      }
    }

    const resizedWidth = Number(customizedColumn.resizeWidth ?? 0);
    if (Number.isFinite(resizedWidth) && resizedWidth > 0) {
      mergedColumn.width = resizedWidth;
      delete mergedColumn.minWidth;
    }
    mergedColumns.push(mergedColumn);
  });

  preparedColumns.forEach((column) => {
    const key = getColumnCustomizationKey(column);
    if (!key || !appliedKeys.has(key)) mergedColumns.push(column);
  });

  const normalizedColumns = mergedColumns.map((column) => {
    if (!column.field || isOperationColumn(column)) return column;
    const normalizedColumn = { ...column } as T;
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
  );
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

function formatCompactNumberDisplayValue(
  field: string,
  value: unknown,
): unknown {
  if (!COMPACT_NUMBER_FIELDS.has(field) || isBlank(value)) {
    return value;
  }
  const numberValue =
    typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (Number.isNaN(numberValue)) {
    return value;
  }
  const digit = PRICE_FIXED_WIDTH_FIELDS.has(field) ? 2 : 3;
  const formatted = numberValue.toFixed(digit);
  return trimTrailingZeros(formatted);
}

function getItemColumnDisplayValue(row: Record<string, any>, field: string) {
  switch (field) {
    case 'fromWarehouseId': {
      return row.fromWarehouseName ?? row.fromWarehouseId;
    }
    case 'productId': {
      return row.productName ?? row.productId;
    }
    case 'remainCount': {
      return formatCompactNumberDisplayValue(
        field,
        row.remainCount ?? row.remainingCount,
      );
    }
    case 'toWarehouseId': {
      return row.toWarehouseName ?? row.toWarehouseId;
    }
    case 'warehouseId': {
      return row.warehouseName ?? row.warehouseId;
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
  options: PrepareItemColumnOptions = {},
) {
  const field = getField(column);
  if (!field) {
    return Number(column.width ?? column.minWidth ?? 0);
  }
  const { editable = false, isCellEditable, rows = [] } = options;
  const declaredWidth = Number(column.width ?? column.minWidth ?? 0);
  const minWidth = TEXT_FIELD_MIN_WIDTHS[field] ?? declaredWidth;
  const contentWidthExtra = getContentWidthExtra(field);
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
      titleWidth + contentWidthExtra,
      rowWidth + contentWidthExtra + controlExtra,
    ),
  );
}

export function prepareStockDocumentItemColumns<T extends ItemColumn>(
  columns: T[],
  options: PrepareItemColumnOptions = {},
) {
  const preparedColumns = columns.map((column) => {
    const next = { ...column } as T;
    const field = getField(next);
    if (isOperationColumn(next)) {
      next.fixed = 'right';
      next.sortable = false;
      next.width = Math.max(Number(next.width) || 0, 64);
      return next;
    }
    if ('ellipsis' in next) {
      delete next.ellipsis;
    }
    delete next.fixed;
    if (next.type === 'seq' || !field) {
      next.sortable = false;
      next.width = Number(next.width ?? next.minWidth ?? 50);
      return next;
    }
    if ('field' in next) {
      next.sortable = true;
    }
    next.width = resolveContentWidth(next, options);
    delete next.minWidth;
    return next;
  });
  const prioritizedColumns = prioritizeProductNameColumn(preparedColumns);
  const { trailingFlexibleColumnMinWidth } = options;
  if (trailingFlexibleColumnMinWidth === undefined) {
    return prioritizedColumns;
  }
  return makeTrailingBusinessColumnFlexible(
    prioritizedColumns,
    trailingFlexibleColumnMinWidth,
  );
}
