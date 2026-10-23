import { stockDecimal } from '#/views/erp/stock/utils/stock-decimal';
export type StockQuantityDetailSortOrder = 'asc' | 'desc';

export interface StockQuantityDetailRow extends Record<string, any> {
  count?: null | number | string;
  createTime?: string;
  creator?: string;
  creatorName?: string;
}

const STOCK_QUANTITY_DETAIL_SORT_FIELDS = new Set([
  'batchNo',
  'count',
  'createTime',
  'creatorName',
  'drawingNo',
  'no',
  'originPlace',
  'productCode',
  'productName',
  'standard',
  'vehicleModel',
  'warehouseName',
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

function comparePopulatedValues(left: unknown, right: unknown) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return textCollator.compare(String(left), String(right));
}

export function isStockQuantityDetailSortField(
  field: unknown,
): field is string {
  return (
    typeof field === 'string' && STOCK_QUANTITY_DETAIL_SORT_FIELDS.has(field)
  );
}

export function resolveStockQuantityDetailSortValue(
  row: StockQuantityDetailRow,
  field: string,
) {
  if (field === 'creatorName') {
    return row.creatorName || row.creator;
  }
  if (field === 'createTime') {
    const timestamp = row.createTime ? Date.parse(row.createTime) : Number.NaN;
    return Number.isNaN(timestamp) ? row.createTime : timestamp;
  }
  return row[field];
}

/** 按页面实际展示值稳定排序，并保证空值在升序、降序时都位于末尾。 */
export function sortStockQuantityDetails<T extends StockQuantityDetailRow>(
  rows: T[],
  field: string,
  order: StockQuantityDetailSortOrder,
) {
  if (!isStockQuantityDetailSortField(field)) {
    return [...rows];
  }
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveStockQuantityDetailSortValue(leftItem.row, field);
      const right = resolveStockQuantityDetailSortValue(rightItem.row, field);
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) {
          return leftBlank ? 1 : -1;
        }
        return leftItem.index - rightItem.index;
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
        return leftItem.index - rightItem.index;
      }
      return order === 'asc' ? result : -result;
    })
    .map(({ row }) => row);
}
