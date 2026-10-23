import { stockListNumber } from './stock-decimal';
/** Product references are display data and must not create document increments. */
export function cleanOtherStockItem<T extends Record<string, any>>(item: T): T {
  const result = { ...item };
  for (const field of [
    'productPurchasePrice',
    'salePrice',
    'lastSalePrice',
    'minPrice',
    'referencePrice',
    'retailPrice',
    'lastPurchasePrice',
    'grossProfitRate',
    'backupPrice1',
    'wholesalePrice',
    'sharePrice',
    'priceVisible',
  ])
    Reflect.deleteProperty(result, field);
  return result;
}

/** A list display never feeds its rounded quantity back into business data. */
export function formatOtherStockListQuantity(value: unknown) {
  return stockListNumber(value as null | number | string | undefined);
}
