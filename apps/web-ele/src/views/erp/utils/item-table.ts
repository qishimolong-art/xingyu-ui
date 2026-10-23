export interface ErpItemUniqueKeyOptions<T extends object> {
  productKey?: keyof T | string;
  warehouseKey?: keyof T | string;
  giftKey?: keyof T | string;
  fixedGift?: boolean;
}

export interface DuplicateErpItems<T> {
  first: T;
  firstIndex: number;
  current: T;
  currentIndex: number;
}

export interface ErpItemSummaryOptions<T extends object> {
  fields: Array<keyof T | string>;
}

function getRowValue(row: object, field: keyof any) {
  return (row as Record<string, any>)[String(field)];
}

function normalizeKeyValue(value: unknown) {
  return value === undefined || value === null || value === ''
    ? '__EMPTY__'
    : value;
}

export function createErpItemUniqueKey<T extends object>(
  row: T,
  options: ErpItemUniqueKeyOptions<T> = {},
) {
  const productKey = options.productKey ?? 'productId';
  const warehouseKey = options.warehouseKey ?? 'warehouseId';
  const giftKey = options.giftKey ?? 'gift';
  const giftValue =
    String(giftKey) in (row as Record<string, any>)
      ? getRowValue(row, giftKey)
      : (options.fixedGift ?? false);

  return [
    normalizeKeyValue(getRowValue(row, productKey)),
    normalizeKeyValue(getRowValue(row, warehouseKey)),
    normalizeKeyValue(giftValue),
  ].join('|');
}

export function findDuplicateErpItems<T extends object>(
  rows: T[],
  options: ErpItemUniqueKeyOptions<T> = {},
): DuplicateErpItems<T> | undefined {
  const productKey = options.productKey ?? 'productId';
  const seen = new Map<string, { index: number; row: T }>();

  for (const [index, row] of rows.entries()) {
    if (!getRowValue(row, productKey)) {
      continue;
    }

    const uniqueKey = createErpItemUniqueKey(row, options);
    const first = seen.get(uniqueKey);
    if (first) {
      return {
        first: first.row,
        firstIndex: first.index,
        current: row,
        currentIndex: index,
      };
    }

    seen.set(uniqueKey, { index, row });
  }

  return undefined;
}

export function calculateErpItemSummary<T extends object>(
  rows: T[],
  options: ErpItemSummaryOptions<T>,
) {
  const summary: Record<string, number> = {};
  for (const field of options.fields) {
    let sum = 0;
    for (const row of rows) {
      const value = Number(getRowValue(row, field) ?? 0);
      sum += Number.isFinite(value) ? value : 0;
    }
    summary[String(field)] = sum;
  }
  return summary;
}
