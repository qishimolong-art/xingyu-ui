type ItemColumn = {
  dataIndex?: string;
  ellipsis?: boolean;
  field?: string;
  fixed?: any;
  minWidth?: number | string;
  slots?: any;
  sortable?: boolean;
  title?: string;
  type?: any;
  visible?: boolean;
  width?: number | string;
};

type CustomizedItemColumn = ItemColumn & {
  renderFixed?: any;
  renderVisible?: boolean;
  resizeWidth?: number | string;
};

export type PrepareSaleDocumentItemColumnOptions = {
  compact?: boolean;
  editable?: boolean;
  getCellContentExtraWidth?: (
    field: string,
    row: Record<string, any>,
  ) => number;
  isCellEditable?: (field: string, row: Record<string, any>) => boolean;
  rows?: Record<string, any>[];
  trailingFlexibleColumnMinWidth?: number;
};

const CONTENT_WIDTH_EXTRA = 34;
const COMPACT_CONTENT_WIDTH_EXTRA = 22;
const EDITABLE_CONTROL_EXTRA = 18;
const SELECT_CONTROL_EXTRA = 38;

const SELECT_CONTROL_PLACEHOLDERS: Record<string, string> = {
  deptId: '请选择所属部门',
  warehouseId: '请选择仓库',
};
const SELECT_CONTROL_FIELDS = new Set(Object.keys(SELECT_CONTROL_PLACEHOLDERS));

const EDITABLE_CONTROL_FIELDS = new Set([
  'adjustAmount',
  'adjustReason',
  'batchNo',
  'brand',
  'count',
  'itemRemark',
  'newPrice',
  'originPlace',
  'productPrice',
  'remark',
  'returnReason',
  'standard',
  'taxPercent',
  'vehicleModel',
  'warehousePosition',
]);

const COMPACT_NUMBER_FIELDS = new Set([
  'actualSaleAmount',
  'adjustAmount',
  'adjustPrice',
  'afterReductionAmount',
  'afterReductionPrice',
  'convertedCount',
  'count',
  'lastSalePrice',
  'newPrice',
  'oldPrice',
  'outCount',
  'packageQty',
  'pieceCount',
  'productPrice',
  'returnCount',
  'saleCostAmount',
  'saleCostPrice',
  'salePrice',
  'stockCount',
  'stockOutBillCount',
  'stockOutBillPickedCount',
  'stockOutBillRemainCount',
  'taxPercent',
  'taxPrice',
  'totalPrice',
  'totalProductPrice',
  'totalWeight',
  'unitWeight',
  'weight',
]);

const PRICE_FIXED_WIDTH_FIELDS = new Set([
  'actualSaleAmount',
  'adjustAmount',
  'adjustPrice',
  'afterReductionAmount',
  'afterReductionPrice',
  'lastSalePrice',
  'newPrice',
  'oldPrice',
  'productPrice',
  'saleCostAmount',
  'saleCostPrice',
  'salePrice',
  'taxPrice',
  'totalPrice',
  'totalProductPrice',
]);
const PRODUCT_NAME_FIELDS = new Set(['partName', 'productId', 'productName']);

const TEXT_FIELD_MIN_WIDTHS: Record<string, number> = {
  actualSaleAmount: 92,
  adjustAmount: 80,
  adjustPrice: 64,
  adjustReason: 100,
  afterReductionAmount: 86,
  afterReductionPrice: 78,
  batchNo: 72,
  brand: 58,
  convertedCount: 58,
  count: 54,
  deptId: 96,
  deptName: 96,
  drawingNo: 66,
  featureCode: 72,
  giftFlag: 58,
  itemRemark: 90,
  lastSalePrice: 96,
  newPrice: 70,
  oldPrice: 104,
  originPlace: 58,
  outCount: 64,
  packageQty: 56,
  partCode: 82,
  partName: 160,
  pieceCount: 56,
  productBarCode: 78,
  productCode: 82,
  productId: 160,
  productName: 160,
  productPrice: 70,
  productUnitName: 50,
  remark: 90,
  returnCount: 64,
  returnReason: 90,
  saleCostAmount: 86,
  saleCostPrice: 86,
  saleOutNo: 112,
  salePrice: 70,
  sourceWarehouseName: 96,
  standard: 70,
  stockCount: 54,
  stockOutBillCount: 72,
  stockOutBillNos: 120,
  stockOutBillPickedCount: 72,
  stockOutBillRemainCount: 72,
  stockOutBillStatusName: 72,
  taxPercent: 70,
  taxPrice: 64,
  totalPrice: 72,
  totalProductPrice: 78,
  totalWeight: 64,
  unit: 50,
  unitWeight: 56,
  vehicleModel: 86,
  warehouseDeptName: 96,
  warehouseId: 96,
  warehouseName: 88,
  warehousePosition: 72,
  weight: 56,
};

const COMPACT_FIELD_MIN_WIDTHS: Record<string, number> = {
  ...TEXT_FIELD_MIN_WIDTHS,
  count: 50,
  giftFlag: 52,
  lastSalePrice: 88,
  productId: 140,
  productPrice: 64,
  totalPrice: 68,
  warehouseId: 88,
};

function getField(column: ItemColumn) {
  return column.field ?? column.dataIndex ?? '';
}

function getFieldMinWidth(field: string, compact = false) {
  return (compact ? COMPACT_FIELD_MIN_WIDTHS : TEXT_FIELD_MIN_WIDTHS)[field];
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

function isFlexibleBusinessColumn(column: ItemColumn) {
  return Boolean(
    getField(column) &&
    column.visible !== false &&
    !column.type &&
    !column.fixed &&
    !isOperationColumn(column),
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
 * Reapplies VXE Table's runtime column settings before choosing the flexible
 * trailing business column. This keeps the rule correct after users hide or
 * reorder columns in the native column-settings panel.
 */
export function applySaleDocumentItemColumnCustomization<T extends object>(
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
    if (isOperationColumn(mergedColumn)) {
      mergedColumn.fixed = 'right';
      mergedColumn.visible = preparedColumn.visible !== false;
    } else {
      mergedColumn.visible =
        customizedColumn.visible ?? customizedColumn.renderVisible;
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
    const preparedColumn = column as ItemColumn & T;
    const key = getColumnCustomizationKey(preparedColumn);
    if (!key || !appliedKeys.has(key)) mergedColumns.push(preparedColumn);
  });

  const normalizedColumns = mergedColumns.map((column) => {
    if (!column.field) return column;
    if (isOperationColumn(column)) {
      return {
        ...column,
        fixed: 'right',
        visible:
          preparedByKey.get(getColumnCustomizationKey(column) || '')
            ?.visible !== false,
      };
    }
    const normalizedColumn = { ...column };
    const width = Number(
      normalizedColumn.width ?? normalizedColumn.minWidth ?? 0,
    );
    if (Number.isFinite(width) && width > 0) normalizedColumn.width = width;
    delete normalizedColumn.minWidth;
    return normalizedColumn;
  });

  const operationColumns = normalizedColumns.filter(isOperationColumn);
  const businessColumns = normalizedColumns.filter(
    (column) => !isOperationColumn(column),
  );
  return [
    ...makeTrailingBusinessColumnFlexible(
      businessColumns,
      trailingFlexibleColumnMinWidth,
    ),
    ...operationColumns,
  ] as T[];
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
  return trimTrailingZeros(numberValue.toFixed(digit));
}

function getItemColumnDisplayValue(row: Record<string, any>, field: string) {
  switch (field) {
    case 'deptId': {
      return row.deptName ?? row.warehouseDeptName ?? row.deptId;
    }
    case 'partCode': {
      return row.partCode ?? row.productCode;
    }
    case 'partName': {
      return row.partName ?? row.productName;
    }
    case 'productId': {
      return row.productName ?? row.productId;
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
  options: PrepareSaleDocumentItemColumnOptions = {},
) {
  const field = getField(column);
  if (!field) {
    return Number(column.width ?? column.minWidth ?? 0);
  }
  const {
    compact = false,
    editable = false,
    getCellContentExtraWidth,
    isCellEditable,
    rows = [],
  } = options;
  const declaredWidth = Number(column.width ?? column.minWidth ?? 0);
  const minWidth = getFieldMinWidth(field, compact) ?? declaredWidth;
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
    const rowExtraWidth = Math.max(
      Number(getCellContentExtraWidth?.(field, row)) || 0,
      0,
    );
    rowWidth = Math.max(
      rowWidth,
      measureTextWidth(displayValue) + rowExtraWidth,
    );
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

export function prepareSaleDocumentItemColumns<T extends object>(
  columns: T[] = [],
  options: PrepareSaleDocumentItemColumnOptions = {},
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

/**
 * Give the last visible business column the exact remaining width. Fixed
 * operation columns are included in the occupied width, so wide layouts do
 * not leave a blank strip before the fixed area. When the viewport is narrow,
 * measured widths remain the minimum and VXE keeps horizontal scrolling.
 */
export function fitSaleDocumentItemColumnsToWidth<T extends object>(
  columns: T[] = [],
  availableWidth = 0,
): T[] {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return columns;

  const typedColumns = columns as Array<ItemColumn & T>;
  const targetIndex = typedColumns.findLastIndex(isFlexibleBusinessColumn);
  if (targetIndex === -1) return columns;
  const target = typedColumns[targetIndex];
  if (!target) return columns;

  const targetMinimum = Number(target.width ?? target.minWidth ?? 0);
  let occupiedWidth = 0;
  typedColumns.forEach((column, index) => {
    if (index === targetIndex || column.visible === false) return;
    const width = Number(column.width ?? column.minWidth ?? 0);
    if (Number.isFinite(width)) occupiedWidth += width;
  });
  const fittedWidth = Math.max(
    Number.isFinite(targetMinimum) ? targetMinimum : 0,
    Math.floor(availableWidth - occupiedWidth),
  );
  const fittedColumns = [...typedColumns];
  fittedColumns[targetIndex] = {
    ...target,
    minWidth: fittedWidth,
    width: fittedWidth,
  };
  return fittedColumns as T[];
}
