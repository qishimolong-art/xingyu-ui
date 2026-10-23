type NamedOption = {
  children?: NamedOption[];
  id?: number;
  name?: string;
};

export type SaleQuoteItemSortContext = {
  deptOptions?: NamedOption[];
  warehouseOptions?: NamedOption[];
};

export type SaleQuoteItemSortOrder = 'asc' | 'desc';

const NUMERIC_FIELDS = new Set([
  'convertedCount',
  'count',
  'lastSalePrice',
  'packageQty',
  'pieceCount',
  'productPrice',
  'stockCount',
  'taxPercent',
  'taxPrice',
  'totalPrice',
  'weight',
]);

const textCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function isSameId(left: unknown, right: unknown) {
  return (
    left !== undefined && right !== undefined && String(left) === String(right)
  );
}

function findOption(
  options: NamedOption[],
  id: unknown,
): NamedOption | undefined {
  for (const option of options) {
    if (isSameId(option.id, id)) {
      return option;
    }
    const child = findOption(option.children ?? [], id);
    if (child) {
      return child;
    }
  }
  return undefined;
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

/** Resolve the displayed value instead of sorting select columns by their ids. */
export function resolveSaleQuoteItemSortValue(
  row: Record<string, any>,
  field: string,
  context: SaleQuoteItemSortContext = {},
) {
  if (NUMERIC_FIELDS.has(field)) {
    const value = row[field];
    return isBlankSortValue(value) ? value : Number(value);
  }
  switch (field) {
    case 'deptId': {
      return findOption(context.deptOptions ?? [], row.deptId)?.name;
    }
    case 'giftFlag': {
      return row.giftFlag ? 1 : 0;
    }
    case 'productId': {
      return row.productName;
    }
    case 'warehouseId': {
      return (
        row.warehouseName ??
        findOption(context.warehouseOptions ?? [], row.warehouseId)?.name
      );
    }
    default: {
      return row[field];
    }
  }
}

/** Sort a display copy, keep blanks last in both directions and preserve ties. */
export function sortSaleQuoteItems<T extends Record<string, any>>(
  data: T[],
  field: string,
  order: SaleQuoteItemSortOrder,
  context: SaleQuoteItemSortContext = {},
) {
  return data
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveSaleQuoteItemSortValue(leftItem.row, field, context);
      const right = resolveSaleQuoteItemSortValue(
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
        return compareTie(leftItem, rightItem);
      }
      const result = comparePopulatedValues(left, right);
      if (result === 0) {
        return compareTie(leftItem, rightItem);
      }
      return order === 'asc' ? result : -result;
    })
    .map(({ row }) => row);
}
