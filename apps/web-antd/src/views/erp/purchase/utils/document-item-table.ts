type NamedOption = {
  children?: NamedOption[];
  deptId?: number;
  deptName?: string;
  id?: number;
  name?: string;
};

export type PurchaseDocumentItemSortContext = {
  deptOptions?: NamedOption[];
  warehouseOptions?: NamedOption[];
};

export type PurchaseDocumentItemSortOrder = 'asc' | 'desc';

type ItemColumn = {
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

type PrepareItemColumnOptions = {
  editable?: boolean;
  isCellEditable?: (field: string, row: Record<string, any>) => boolean;
  rows?: Record<string, any>[];
  trailingFlexibleColumnMinWidth?: number;
};

const textCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

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
  'adjustRatio',
  'barCode',
  'batchNo',
  'count',
  'drawingNo',
  'newPrice',
  'productPrice',
  'remark',
  'taxPercent',
  'warehousePosition',
  'wholeQty',
]);
const COMPACT_NUMBER_FIELDS = new Set([
  'adjustPrice',
  'adjustRatio',
  'count',
  'inCount',
  'lastPurchasePrice',
  'newPrice',
  'oldPrice',
  'packageQty',
  'pieceCount',
  'productPrice',
  'returnableCount',
  'returnCount',
  'stockCount',
  'taxExclusivePrice',
  'taxPercent',
  'taxPrice',
  'totalCount',
  'totalPrice',
  'totalProductPrice',
  'weight',
  'wholeQty',
]);
const PRICE_FIXED_WIDTH_FIELDS = new Set([
  'adjustPrice',
  'lastPurchasePrice',
  'newPrice',
  'oldPrice',
  'productPrice',
  'taxExclusivePrice',
  'taxPrice',
  'totalPrice',
  'totalProductPrice',
]);
const PRODUCT_NAME_FIELDS = new Set(['partName', 'productId', 'productName']);
const TEXT_FIELD_MIN_WIDTHS: Record<string, number> = {
  adjustPrice: 72,
  adjustRatio: 78,
  adjustStatus: 72,
  batchNo: 72,
  barCode: 78,
  brand: 58,
  count: 54,
  deptId: 88,
  drawingNo: 66,
  factoryCode: 78,
  featureCode: 72,
  gift: 52,
  inCount: 72,
  inNo: 120,
  invoiceStatus: 72,
  lastPurchasePrice: 78,
  newPrice: 78,
  oldPrice: 72,
  originPlace: 58,
  packageQty: 56,
  partCode: 82,
  partName: 160,
  pieceCount: 56,
  productBarCode: 78,
  productCode: 82,
  productId: 160,
  productName: 160,
  productPrice: 64,
  productUnitName: 50,
  remark: 90,
  returnableCount: 72,
  returnCount: 72,
  returnStatus: 72,
  sourceInNo: 110,
  standard: 70,
  stockCount: 54,
  taxExclusivePrice: 86,
  taxPercent: 70,
  taxPrice: 72,
  totalCount: 72,
  totalPrice: 78,
  totalProductPrice: 78,
  vehicleModel: 86,
  warehouseId: 88,
  warehouseName: 88,
  warehousePosition: 72,
  weight: 56,
  wholeQty: 70,
};

function getContentWidthExtra(field: string) {
  return COMPACT_NUMBER_FIELDS.has(field)
    ? COMPACT_CONTENT_WIDTH_EXTRA
    : CONTENT_WIDTH_EXTRA;
}

function isSameId(left: unknown, right: unknown) {
  return (
    left !== undefined && right !== undefined && String(left) === String(right)
  );
}

function findOption(
  options: NamedOption[],
  id: unknown,
): NamedOption | undefined {
  for (const option of options) {
    if (isSameId(option.id, id)) return option;
    const child = findOption(option.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}

function isBlank(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function compareValues(left: unknown, right: unknown) {
  const leftNumber = toComparableNumber(left);
  const rightNumber = toComparableNumber(right);
  if (leftNumber !== undefined && rightNumber !== undefined) {
    return leftNumber - rightNumber;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  return textCollator.compare(String(left), String(right));
}

function toComparableNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }
  if (
    typeof value === 'string' &&
    /^[-+]?(?:\d+\.?\d*|\.\d+)$/u.test(value.trim())
  ) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function compareStableRows(
  left: { index: number; row: Record<string, any> },
  right: { index: number; row: Record<string, any> },
) {
  const leftId = toComparableNumber(left.row.id);
  const rightId = toComparableNumber(right.row.id);
  if (leftId !== undefined && rightId !== undefined && leftId !== rightId) {
    return leftId - rightId;
  }
  return left.index - right.index;
}

export function resolvePurchaseDocumentItemSortValue(
  row: Record<string, any>,
  field: string,
  context: PurchaseDocumentItemSortContext = {},
) {
  switch (field) {
    case 'deptId': {
      return (
        row.deptName ?? findOption(context.deptOptions ?? [], row.deptId)?.name
      );
    }
    case 'gift':
    case 'giftFlag': {
      return row[field] ? 1 : 0;
    }
    case 'inStatus': {
      const inCount = Number(row.inCount || 0);
      const count = Number(row.count || 0);
      if (inCount <= 0) {
        return 0;
      }
      return inCount >= count ? 2 : 1;
    }
    case 'pieceCount': {
      const count = toComparableNumber(row.count);
      const packageQty = toComparableNumber(row.packageQty);
      return count !== undefined && packageQty !== undefined && packageQty > 0
        ? count / packageQty
        : undefined;
    }
    case 'partName':
    case 'productId':
    case 'productName': {
      return row.productName ?? row.partName;
    }
    case 'sourceDocNo': {
      return row.sourceDocNo ?? row.sourceInNo;
    }
    case 'sourceType':
    case 'sourceTypeName': {
      return row.sourceTypeName ?? row.sourceType;
    }
    case 'warehouseDeptName': {
      return (
        row.warehouseDeptName ??
        findOption(context.warehouseOptions ?? [], row.warehouseId)?.deptName
      );
    }
    case 'warehouseId': {
      return (
        row.warehouseName ??
        findOption(context.warehouseOptions ?? [], row.warehouseId)?.name
      );
    }
    default: {
      return row[field];
    }
  }
}

/** Stable local sort with blank values kept last in both directions. */
export function sortPurchaseDocumentItems<T extends Record<string, any>>(
  rows: T[],
  field: string,
  order: PurchaseDocumentItemSortOrder,
  context: PurchaseDocumentItemSortContext = {},
) {
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolvePurchaseDocumentItemSortValue(
        leftItem.row,
        field,
        context,
      );
      const right = resolvePurchaseDocumentItemSortValue(
        rightItem.row,
        field,
        context,
      );
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;
        return compareStableRows(leftItem, rightItem);
      }
      const result = compareValues(left, right);
      if (result === 0) return compareStableRows(leftItem, rightItem);
      return order === 'asc' ? result : -result;
    })
    .map(({ row }) => row);
}

function isOperationColumn(column: ItemColumn) {
  return (
    column.field === 'actions' ||
    column.field === 'operation' ||
    column.slots?.default === 'actions'
  );
}

function prioritizeProductNameColumn<T extends ItemColumn>(columns: T[]) {
  const productNameIndex = columns.findIndex(
    (column) => column.field && PRODUCT_NAME_FIELDS.has(column.field),
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
  return PRICE_FIXED_WIDTH_FIELDS.has(field)
    ? formatted
    : trimTrailingZeros(formatted);
}

function getItemColumnDisplayValue(row: Record<string, any>, field: string) {
  switch (field) {
    case 'deptId': {
      return row.deptName ?? row.deptId;
    }
    case 'gift': {
      if (row.gift) {
        return '赠品';
      }
      return '';
    }
    case 'inStatus': {
      const inCount = Number(row.inCount || 0);
      const count = Number(row.count || 0);
      if (inCount > 0 && inCount >= count) return '已入库';
      if (inCount > 0) return '部分入库';
      return '未入库';
    }
    case 'productId': {
      return row.productName ?? row.productId;
    }
    case 'productPrice': {
      if (row.gift) {
        return '0（赠品）';
      }
      return formatCompactNumberDisplayValue(field, row.productPrice);
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
  return Boolean(column.field && EDITABLE_CONTROL_FIELDS.has(column.field));
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
  if (!column.field) {
    return Number(column.width ?? column.minWidth ?? 0);
  }
  const { editable = false, isCellEditable, rows = [] } = options;
  const field = column.field;
  const declaredWidth = Number(column.width ?? column.minWidth ?? 0);
  const minWidth =
    field === 'gift' && editable
      ? Math.max(TEXT_FIELD_MIN_WIDTHS[field] ?? 0, 86)
      : (TEXT_FIELD_MIN_WIDTHS[field] ?? declaredWidth);
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

/**
 * Keep the product-name column as the first business column while applying the
 * shared item-grid contract: only operations are fixed, and only business
 * fields are sortable.
 */
export function preparePurchaseDocumentItemColumns<T extends ItemColumn>(
  columns: T[],
  options: PrepareItemColumnOptions = {},
) {
  const preparedColumns = columns.map((column) => {
    const next = { ...column } as T;
    if (isOperationColumn(next)) {
      next.fixed = 'right';
      next.sortable = false;
      next.width = Math.max(Number(next.width) || 0, 64);
      return next;
    }
    delete next.fixed;
    if (next.type === 'seq' || !next.field) {
      next.sortable = false;
      return next;
    }
    next.sortable = true;
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
