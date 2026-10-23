export type StockOutBillItemSortOrder = 'ascend' | 'descend';

const numericFields = new Set([
  'count',
  'packageQty',
  'pickCount',
  'pickedCount',
  'productPrice',
  'remainCount',
  'status',
  'wholeQty',
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

function resolveSortValue(row: Record<string, any>, field: string) {
  const value = row[field];
  if (!numericFields.has(field) || isBlank(value)) {
    return value;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

/**
 * Sort a display copy without mutating the API rows. Empty values stay last in
 * either direction and equal values keep their original order.
 */
export function sortStockOutBillItems<T extends Record<string, any>>(
  data: T[],
  field?: string,
  order?: StockOutBillItemSortOrder,
) {
  if (!field || !order) {
    return [...data];
  }
  return data
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveSortValue(leftItem.row, field);
      const right = resolveSortValue(rightItem.row, field);
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) {
          return leftBlank ? 1 : -1;
        }
        return leftItem.index - rightItem.index;
      }
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : textCollator.compare(String(left), String(right));
      if (result === 0) {
        return leftItem.index - rightItem.index;
      }
      return order === 'ascend' ? result : -result;
    })
    .map(({ row }) => row);
}
