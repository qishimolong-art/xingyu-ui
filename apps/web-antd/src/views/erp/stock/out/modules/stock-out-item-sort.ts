export type StockOutItemSortOrder = 'asc' | 'desc';

type WarehouseOption = {
  id?: number;
  name?: string;
};

const numericFields = new Set([
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

function isBlank(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function resolveWarehouseName(
  warehouseId: unknown,
  warehouseOptions: WarehouseOption[],
) {
  return warehouseOptions.find(
    (option) => String(option.id) === String(warehouseId),
  )?.name;
}

function resolveSortValue(
  row: Record<string, any>,
  field: string,
  warehouseOptions: WarehouseOption[],
) {
  if (field === 'productId') return row.productName;
  if (field === 'warehouseId') {
    return (
      row.warehouseName ??
      resolveWarehouseName(row.warehouseId, warehouseOptions)
    );
  }
  if (field === 'pieceCount') {
    const packageQty = Number(row.packageQty);
    return packageQty > 0 ? Number(row.count) / packageQty : undefined;
  }
  const value = row[field];
  if (!numericFields.has(field) || isBlank(value)) return value;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

/**
 * Sort the displayed item rows without mutating their source order. Empty
 * values stay last in either direction and equal values remain stable.
 */
export function sortStockOutItems<T extends Record<string, any>>(
  data: T[],
  field?: string,
  order?: StockOutItemSortOrder,
  warehouseOptions: WarehouseOption[] = [],
) {
  if (!field || !order) return [...data];
  return data
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveSortValue(leftItem.row, field, warehouseOptions);
      const right = resolveSortValue(rightItem.row, field, warehouseOptions);
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;
        return compareStableRows(leftItem, rightItem);
      }
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : textCollator.compare(String(left), String(right));
      if (result === 0) return compareStableRows(leftItem, rightItem);
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
