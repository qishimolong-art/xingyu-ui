/* eslint-disable unicorn/require-number-to-fixed-digits-argument -- BigNumber.toFixed() preserves all decimal digits. */
import { stockDecimal } from '#/views/erp/stock/utils/stock-decimal';
type WarehouseOption = {
  id?: number;
  name?: string;
};

export type StockInItemSortContext = {
  warehouseOptions?: WarehouseOption[];
};

export type StockInItemSortOrder = 'asc' | 'desc';

const STOCK_IN_ITEM_SORT_FIELDS = new Set([
  'batchNo',
  'count',
  'packageQty',
  'pieceCount',
  'productBarCode',
  'productCode',
  'productId',
  'productPrice',
  'productUnitName',
  'remark',
  'stockCount',
  'totalPrice',
  'totalWeight',
  'warehouseId',
  'weight',
]);

const NUMERIC_FIELDS = new Set([
  'count',
  'packageQty',
  'pieceCount',
  'productPrice',
  'stockCount',
  'totalPrice',
  'totalWeight',
  'weight',
]);

const textCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function findWarehouseName(options: WarehouseOption[], id: unknown) {
  return options.find(
    (option) =>
      option.id !== undefined &&
      id !== undefined &&
      String(option.id) === String(id),
  )?.name;
}

function isBlank(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function comparePopulatedValues(left: unknown, right: unknown) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return textCollator.compare(String(left), String(right));
}

export function isStockInItemSortField(field: unknown): field is string {
  return typeof field === 'string' && STOCK_IN_ITEM_SORT_FIELDS.has(field);
}

/** Resolve the value actually rendered by an other-inbound item column. */
export function resolveStockInItemSortValue(
  row: Record<string, any>,
  field: string,
  context: StockInItemSortContext = {},
) {
  if (field === 'warehouseId') {
    return (
      row.warehouseName ??
      findWarehouseName(context.warehouseOptions ?? [], row.warehouseId)
    );
  }
  if (field === 'productId') {
    return row.productName;
  }
  if (field === 'pieceCount') {
    const packageQty = Number(row.packageQty);
    return packageQty > 0 ? Number(row.count) / packageQty : undefined;
  }
  const value = row[field];
  if (NUMERIC_FIELDS.has(field) && !isBlank(value)) {
    try {
      return stockDecimal(value).toFixed();
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Sort a display copy, keep blanks last in both directions, and preserve the
 * source order when two displayed values are equal.
 */
export function sortStockInItems<T extends Record<string, any>>(
  rows: T[],
  field: string,
  order: StockInItemSortOrder,
  context: StockInItemSortContext = {},
) {
  if (!isStockInItemSortField(field)) {
    return [...rows];
  }
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveStockInItemSortValue(leftItem.row, field, context);
      const right = resolveStockInItemSortValue(rightItem.row, field, context);
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) {
          return leftBlank ? 1 : -1;
        }
        return compareStableRows(leftItem, rightItem);
      }
      const numericField = NUMERIC_FIELDS.has(field);
      const result =
        numericField && left !== '****' && right !== '****'
          ? (stockDecimal(left as number | string).comparedTo(
              stockDecimal(right as number | string),
            ) ?? 0)
          : comparePopulatedValues(left, right);
      if (result === 0) {
        return compareStableRows(leftItem, rightItem);
      }
      return order === 'asc' ? result : -result;
    })
    .map(({ row }) => row);
}

function compareStableRows<T extends Record<string, any>>(
  left: { index: number; row: T },
  right: { index: number; row: T },
) {
  if (
    left.row.id !== null &&
    left.row.id !== undefined &&
    right.row.id !== null &&
    right.row.id !== undefined
  ) {
    return Number(left.row.id) - Number(right.row.id);
  }
  if (left.row.clientRowKey && right.row.clientRowKey) {
    return textCollator.compare(left.row.clientRowKey, right.row.clientRowKey);
  }
  return left.index - right.index;
}
