import type { ErpSaleCartApi } from '#/api/erp/sale/cart';

import { cloneDeep } from '@vben/utils';

import { saleDecimalMultiply } from '../../utils/decimal';

type SaleCartItemLike = ErpSaleCartApi.SaleCartItem & {
  gift?: boolean | number | string;
  giftFlag?: boolean | number | string;
  isGift?: boolean | number | string;
  seq?: number | string;
};

const FILLABLE_FIELDS: Array<keyof SaleCartItemLike> = [
  'productCode',
  'productName',
  'productBarCode',
  'productUnitId',
  'productUnitName',
  'weight',
  'packageQty',
  'salePrice',
  'lastSalePrice',
  'warehouseId',
  'warehousePosition',
  'drawingNo',
  'batchNo',
  'batchNoEnabled',
  'barCode',
  'brand',
  'vehicleModel',
  'originPlace',
  'standard',
  'remark',
  'stockCount',
];

function isBlankValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function toNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeGiftFlag(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    return ['1', 'gift', 'true', 'y', 'yes', '\u662f', '\u8d60\u54c1'].includes(
      normalizedValue,
    );
  }
  return false;
}

function isGiftItem(item: SaleCartItemLike) {
  return normalizeGiftFlag(item.giftFlag ?? item.isGift ?? item.gift);
}

function normalizeAmounts<T extends SaleCartItemLike>(item: T) {
  item.count = toNumber(item.count);
  item.productPrice = toNumber(item.productPrice);
  item.totalPrice = saleDecimalMultiply(item.productPrice, item.count) || 0;
  item.taxPercent = undefined;
  item.taxPrice = 0;
  return item;
}

function getMergeKey(item: SaleCartItemLike) {
  const giftKey = isGiftItem(item) ? 'gift' : 'normal';
  const batchNo =
    typeof item.batchNo === 'string' ? item.batchNo.trim() : item.batchNo;
  return `${item.productId ?? 'unknown'}::${item.warehouseId ?? 'unknown'}::${batchNo ?? ''}::${giftKey}`;
}

export function mergeSaleCartItems<T extends SaleCartItemLike>(
  items: T[] = [],
) {
  const mergedItems: T[] = [];
  const itemMap = new Map<string, T>();

  items.forEach((item) => {
    const nextItem = cloneDeep(item) as T;
    const hasCurrentPrice = !isBlankValue(nextItem.productPrice);
    normalizeAmounts(nextItem);
    const mergeKey = getMergeKey(nextItem);
    const existedItem = itemMap.get(mergeKey);
    if (!existedItem) {
      itemMap.set(mergeKey, nextItem);
      mergedItems.push(nextItem);
      return;
    }

    existedItem.count = toNumber(existedItem.count) + toNumber(nextItem.count);
    if (hasCurrentPrice) {
      existedItem.productPrice = nextItem.productPrice;
    }
    FILLABLE_FIELDS.forEach((field) => {
      if (isBlankValue(existedItem[field]) && !isBlankValue(nextItem[field])) {
        existedItem[field] = nextItem[field] as never;
      }
    });
    normalizeAmounts(existedItem);
  });

  return mergedItems;
}
