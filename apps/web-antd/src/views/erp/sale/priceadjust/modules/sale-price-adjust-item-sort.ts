import { saleDecimalMultiply } from '../../utils/decimal';

export type PriceAdjustItemSortOrder = 'asc' | 'desc';

const textCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

const NUMERIC_FIELDS = new Set([
  'adjustAmount',
  'adjustPrice',
  'newPrice',
  'oldPrice',
  'outCount',
  'packageQty',
  'pieceCount',
  'stockCount',
  'weight',
]);

function isBlankSortValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function resolveSortValue(row: Record<string, any>, field: string) {
  if (field === 'adjustAmount') {
    return saleDecimalMultiply(row.newPrice || 0, row.outCount || 0);
  }
  const value = row[field];
  return NUMERIC_FIELDS.has(field) && !isBlankSortValue(value)
    ? Number(value)
    : value;
}

function compareValues(left: unknown, right: unknown) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return textCollator.compare(String(left), String(right));
}

function compareTie(
  left: { index: number; row: Record<string, any> },
  right: { index: number; row: Record<string, any> },
) {
  const leftId = Number(left.row.id);
  const rightId = Number(right.row.id);
  if (
    Number.isFinite(leftId) &&
    Number.isFinite(rightId) &&
    leftId !== rightId
  ) {
    return leftId - rightId;
  }
  return left.index - right.index;
}

/** 按界面实际展示值稳定排序，并保证升降序时空值都位于末尾。 */
export function sortPriceAdjustItems<T extends Record<string, any>>(
  rows: T[],
  field: string,
  order: PriceAdjustItemSortOrder,
) {
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveSortValue(leftItem.row, field);
      const right = resolveSortValue(rightItem.row, field);
      const leftBlank = isBlankSortValue(left);
      const rightBlank = isBlankSortValue(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) {
          return leftBlank ? 1 : -1;
        }
        return compareTie(leftItem, rightItem);
      }
      const result = compareValues(left, right);
      if (result === 0) {
        return compareTie(leftItem, rightItem);
      }
      return order === 'asc' ? result : -result;
    })
    .map(({ row }) => row);
}
