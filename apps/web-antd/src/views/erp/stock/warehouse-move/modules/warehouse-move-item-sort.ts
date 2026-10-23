import { stockDecimal } from '#/views/erp/stock/utils/stock-decimal';
export type WarehouseMoveItemSortOrder = 'asc' | 'desc';

const textCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

const numericFields = new Set([
  'costAmount',
  'costPrice',
  'count',
  'fromStockCount',
  'packageQty',
  'pieceCount',
  'productPrice',
  'toStockCount',
  'totalPrice',
  'totalWeight',
  'weight',
]);

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

export function resolveWarehouseMoveItemSortValue(
  row: Record<string, any>,
  field: string,
) {
  if (field === 'productId') {
    return row.productName;
  }
  if (field === 'fromWarehouseId') {
    return row.fromWarehouseName;
  }
  if (field === 'toWarehouseId') {
    return row.toWarehouseName;
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

/** 按实际展示值稳定排序，并保证空值在升序、降序时都位于末尾。 */
export function sortWarehouseMoveItems<T extends Record<string, any>>(
  rows: T[],
  field: string,
  order: WarehouseMoveItemSortOrder,
) {
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveWarehouseMoveItemSortValue(leftItem.row, field);
      const right = resolveWarehouseMoveItemSortValue(rightItem.row, field);
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) {
          return leftBlank ? 1 : -1;
        }
        return compareStableRows(leftItem, rightItem);
      }
      const numericField = [
        'actualCount',
        'costAmount',
        'costPrice',
        'count',
        'pickedCount',
        'pieceCount',
        'productPrice',
        'remainCount',
        'stockCount',
        'totalPrice',
        'totalWeight',
        'weight',
      ].includes(field);
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
