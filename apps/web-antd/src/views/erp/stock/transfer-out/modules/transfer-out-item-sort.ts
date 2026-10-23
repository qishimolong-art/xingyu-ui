import { stockDecimal } from '#/views/erp/stock/utils/stock-decimal';
type WarehouseOption = {
  id?: number;
  name?: string;
};

export type TransferOutItemSortContext = {
  fromWarehouseOptions?: WarehouseOption[];
  toWarehouseOptions?: WarehouseOption[];
};

export type TransferOutItemSortOrder = 'asc' | 'desc';

const textCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

const numericFields = new Set([
  'count',
  'packageQty',
  'pieceCount',
  'productPrice',
  'sourceCount',
  'stockCount',
  'totalPrice',
  'totalWeight',
  'weight',
]);

function findWarehouseName(options: WarehouseOption[], id: unknown) {
  return options.find(
    (option) =>
      option.id !== undefined &&
      id !== undefined &&
      String(option.id) === String(id),
  )?.name;
}

function isBlankSortValue(value: unknown) {
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

/** Resolve the value rendered by the transfer-out item column. */
export function resolveTransferOutItemSortValue(
  row: Record<string, any>,
  field: string,
  context: TransferOutItemSortContext = {},
) {
  switch (field) {
    case 'fromWarehouseId': {
      return (
        row.fromWarehouseName ??
        findWarehouseName(
          context.fromWarehouseOptions ?? [],
          row.fromWarehouseId,
        )
      );
    }
    case 'productId': {
      return row.productName;
    }
    case 'toWarehouseId': {
      return (
        row.toWarehouseName ??
        findWarehouseName(context.toWarehouseOptions ?? [], row.toWarehouseId)
      );
    }
    default: {
      if (field === 'pieceCount') {
        const packageQty = Number(row.packageQty);
        return packageQty > 0 ? Number(row.count) / packageQty : undefined;
      }
      const value = row[field];
      if (!numericFields.has(field) || isBlankSortValue(value)) return value;
      const number = Number(value);
      return Number.isFinite(number) ? number : value;
    }
  }
}

/**
 * Sort a display copy, keep blanks last in both directions, and preserve the
 * source order when two displayed values are equal.
 */
export function sortTransferOutItems<T extends Record<string, any>>(
  data: T[],
  field: string,
  order: TransferOutItemSortOrder,
  context: TransferOutItemSortContext = {},
) {
  return data
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveTransferOutItemSortValue(
        leftItem.row,
        field,
        context,
      );
      const right = resolveTransferOutItemSortValue(
        rightItem.row,
        field,
        context,
      );
      const leftBlank = isBlankSortValue(left);
      const rightBlank = isBlankSortValue(right);
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
