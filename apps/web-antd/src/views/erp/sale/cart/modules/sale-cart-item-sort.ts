type NamedOption = {
  children?: NamedOption[];
  deptId?: number;
  deptName?: string;
  id?: number;
  name?: string;
};

export type SaleCartItemSortContext = {
  deptOptions?: NamedOption[];
  warehouseOptions?: NamedOption[];
};

export type SaleCartItemSortOrder = 'asc' | 'desc';

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
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  return textCollator.compare(String(left), String(right));
}

/** Resolve the value that is actually displayed by a sale-cart item column. */
export function resolveSaleCartItemSortValue(
  row: Record<string, any>,
  field: string,
  context: SaleCartItemSortContext = {},
) {
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
    case 'warehouseDeptName': {
      if (row.warehouseDeptName) {
        return row.warehouseDeptName;
      }
      const warehouse = findOption(
        context.warehouseOptions ?? [],
        row.warehouseId,
      );
      return (
        warehouse?.deptName ??
        findOption(
          context.deptOptions ?? [],
          row.warehouseDeptId ?? warehouse?.deptId,
        )?.name
      );
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

/**
 * Sort a display copy while keeping empty values last in both directions and
 * preserving source order for equal values.
 */
export function sortSaleCartItems<T extends Record<string, any>>(
  data: T[],
  field: string,
  order: SaleCartItemSortOrder,
  context: SaleCartItemSortContext = {},
) {
  return data
    .map((row, index) => ({ index, row }))
    .toSorted((leftItem, rightItem) => {
      const left = resolveSaleCartItemSortValue(leftItem.row, field, context);
      const right = resolveSaleCartItemSortValue(rightItem.row, field, context);
      const leftBlank = isBlankSortValue(left);
      const rightBlank = isBlankSortValue(right);
      if (leftBlank || rightBlank) {
        if (leftBlank !== rightBlank) {
          return leftBlank ? 1 : -1;
        }
        return leftItem.index - rightItem.index;
      }
      const result = comparePopulatedValues(left, right);
      if (result === 0) {
        return leftItem.index - rightItem.index;
      }
      return order === 'asc' ? result : -result;
    })
    .map(({ row }) => row);
}
