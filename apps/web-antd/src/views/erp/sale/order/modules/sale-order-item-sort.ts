type NamedOption = { children?: NamedOption[]; id?: number; name?: string };

export type SaleOrderItemSortOrder = 'asc' | 'desc';

const NUMERIC_FIELDS = new Set([
  'count',
  'lastSalePrice',
  'packageQty',
  'pieceCount',
  'productPrice',
  'saleCostAmount',
  'saleCostPrice',
  'stockCount',
  'taxPercent',
  'taxPrice',
  'totalPrice',
  'totalProductPrice',
  'weight',
]);
const collator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function findOption(
  options: NamedOption[],
  id: unknown,
): NamedOption | undefined {
  for (const option of options) {
    if (id !== undefined && String(option.id) === String(id)) return option;
    const child = findOption(option.children ?? [], id);
    if (child) return child;
  }
}

function blank(value: unknown) {
  return value == null || (typeof value === 'string' && value.trim() === '');
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

export function sortSaleOrderItems<T extends Record<string, any>>(
  rows: T[],
  field: string,
  order: SaleOrderItemSortOrder,
  context: {
    deptOptions?: NamedOption[];
    warehouseOptions?: NamedOption[];
  } = {},
) {
  const valueOf = (row: T) => {
    if (NUMERIC_FIELDS.has(field))
      return blank(row[field]) ? row[field] : Number(row[field]);
    if (field === 'productId') return row.productName;
    if (field === 'warehouseId') {
      return (
        row.warehouseName ??
        findOption(context.warehouseOptions ?? [], row.warehouseId)?.name
      );
    }
    if (field === 'deptId') {
      return (
        row.deptName ??
        row.warehouseDeptName ??
        findOption(context.deptOptions ?? [], row.deptId)?.name
      );
    }
    if (field === 'giftFlag') return row.giftFlag ? 1 : 0;
    return row[field];
  };
  return rows
    .map((row, index) => ({ index, row }))
    .toSorted((left, right) => {
      const leftValue = valueOf(left.row);
      const rightValue = valueOf(right.row);
      if (blank(leftValue) || blank(rightValue)) {
        if (blank(leftValue) !== blank(rightValue))
          return blank(leftValue) ? 1 : -1;
        return compareTie(left, right);
      }
      const compared =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : collator.compare(String(leftValue), String(rightValue));
      return compared === 0
        ? compareTie(left, right)
        : order === 'asc'
          ? compared
          : -compared;
    })
    .map(({ row }) => row);
}
