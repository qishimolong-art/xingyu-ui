import { stockDecimal } from '#/views/erp/stock/utils/stock-decimal';
export type TransferInItemSortOrder = 'asc' | 'desc';

const TRANSFER_IN_ITEM_SORT_FIELDS = new Set([
  'batchNo',
  'count',
  'fromDeptName',
  'fromWarehouseDeptName',
  'fromWarehouseName',
  'packageQty',
  'productBarCode',
  'productCode',
  'productName',
  'productPrice',
  'productUnitName',
  'remark',
  'stockCount',
  'toDeptName',
  'totalPrice',
  'totalWeight',
  'toWarehouseDeptName',
  'toWarehouseName',
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

function comparePopulatedValues(left: unknown, right: unknown) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return textCollator.compare(String(left), String(right));
}

export function isTransferInItemSortField(field: unknown): field is string {
  return typeof field === 'string' && TRANSFER_IN_ITEM_SORT_FIELDS.has(field);
}

/** 按明细表实际展示值稳定排序，空值在升序、降序时都保持在末尾。 */
export function sortTransferInItems<T extends Record<string, any>>(
  rows: T[],
  field: string,
  order: TransferInItemSortOrder,
) {
  if (!isTransferInItemSortField(field)) {
    return [...rows];
  }
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = leftItem.row[field];
      const right = rightItem.row[field];
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
