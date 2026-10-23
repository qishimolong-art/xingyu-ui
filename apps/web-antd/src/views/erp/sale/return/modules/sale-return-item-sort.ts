type NamedOption = {
  children?: NamedOption[];
  id?: number;
  name?: string;
};

export type SaleReturnItemSortContext = {
  deptOptions?: NamedOption[];
  warehouseOptions?: NamedOption[];
};

export type SaleReturnItemSortOrder = 'asc' | 'desc';

const NUMERIC_FIELDS = new Set([
  'count',
  'outCount',
  'packageQty',
  'pieceCount',
  'productPrice',
  'returnCount',
  'stockCount',
  'taxPercent',
  'taxPrice',
  'totalPrice',
  'totalProductPrice',
  'weight',
]);

const textCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function findOption(
  options: NamedOption[],
  id: unknown,
): NamedOption | undefined {
  for (const option of options) {
    if (id !== undefined && String(option.id) === String(id)) {
      return option;
    }
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

export function resolveSaleReturnItemSortValue(
  row: Record<string, any>,
  field: string,
  context: SaleReturnItemSortContext = {},
) {
  if (NUMERIC_FIELDS.has(field)) {
    const value = row[field];
    return isBlank(value) ? value : Number(value);
  }
  if (field === 'productId') return row.productName;
  if (field === 'warehouseId') {
    return (
      row.warehouseName ??
      findOption(context.warehouseOptions ?? [], row.warehouseId)?.name
    );
  }
  if (field === 'deptId') {
    return (
      row.deptName ?? findOption(context.deptOptions ?? [], row.deptId)?.name
    );
  }
  if (field === 'giftFlag') return row.giftFlag ? 1 : 0;
  return row[field];
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

export function sortSaleReturnItems<T extends Record<string, any>>(
  rows: T[],
  field: string,
  order: SaleReturnItemSortOrder,
  context: SaleReturnItemSortContext = {},
) {
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveSaleReturnItemSortValue(leftItem.row, field, context);
      const right = resolveSaleReturnItemSortValue(
        rightItem.row,
        field,
        context,
      );
      const leftBlank = isBlank(left);
      const rightBlank = isBlank(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;
        return compareTie(leftItem, rightItem);
      }
      const compared =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : textCollator.compare(String(left), String(right));
      if (compared === 0) return compareTie(leftItem, rightItem);
      return order === 'asc' ? compared : -compared;
    })
    .map(({ row }) => row);
}
