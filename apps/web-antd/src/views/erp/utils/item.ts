export interface ErpItemDuplicateOptions<T extends Record<string, any>> {
  batchField?: keyof T | string;
  giftField?: keyof T | string;
  productField?: keyof T | string;
  warehouseField?: keyof T | string;
}

export interface ErpDuplicateItem<T> {
  firstIndex: number;
  index: number;
  item: T;
  key: string;
}

function normalizeKeyPart(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

export function isBatchNoEnabled(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
  }
  return value === true || value === 1;
}

export function buildErpItemDuplicateKey<T extends Record<string, any>>(
  item: T,
  options: ErpItemDuplicateOptions<T> = {},
) {
  const productField = options.productField || 'productId';
  const warehouseField = options.warehouseField || 'warehouseId';
  const batchField = options.batchField;
  const giftField = options.giftField || 'gift';
  const productId = item[productField];
  if (productId === null || productId === undefined || productId === '') {
    return '';
  }
  return [
    normalizeKeyPart(productId),
    normalizeKeyPart(item[warehouseField]),
    ...(batchField ? [normalizeKeyPart(item[batchField])] : []),
    item[giftField] === true ? '1' : '0',
  ].join('|');
}

export function findDuplicateErpItems<T extends Record<string, any>>(
  items: T[],
  options: ErpItemDuplicateOptions<T> = {},
) {
  const seenKeys = new Map<string, number>();
  const duplicates: ErpDuplicateItem<T>[] = [];
  (items || []).forEach((item, index) => {
    const key = buildErpItemDuplicateKey(item, options);
    if (!key) {
      return;
    }
    const firstIndex = seenKeys.get(key);
    if (firstIndex === undefined) {
      seenKeys.set(key, index);
      return;
    }
    duplicates.push({ firstIndex, index, item, key });
  });
  return duplicates;
}

export function assertNoDuplicateErpItems<T extends Record<string, any>>(
  items: T[],
  messageBuilder?: (duplicate: ErpDuplicateItem<T>) => string,
  options: ErpItemDuplicateOptions<T> = {},
) {
  const [duplicate] = findDuplicateErpItems(items, options);
  if (duplicate) {
    throw new Error(
      messageBuilder?.(duplicate) ||
        `\u7b2c ${duplicate.index + 1} \u884c\uff1a\u4ea7\u54c1\u3001\u4ed3\u5e93\u3001\u8d60\u54c1\u6807\u8bc6\u91cd\u590d\uff0c\u8bf7\u5408\u5e76\u540e\u518d\u63d0\u4ea4`,
    );
  }
}
