import { parseOptionalNumber } from './text-number';

type SaleDraftItem = {
  count?: unknown;
  giftFlag?: unknown;
  outCount?: unknown;
  productId?: unknown;
  productPrice?: unknown;
  saleOutItemId?: unknown;
  sourceOutItemId?: unknown;
  warehouseId?: unknown;
};

type SaleDraftItemOptions = {
  countField?: 'count' | 'outCount';
  priceMode?: 'none' | 'nonNegative' | 'positive';
  requireSaleOutItem?: boolean;
  requireWarehouse?: boolean;
};

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

function hasValidPrice(
  item: SaleDraftItem,
  mode: SaleDraftItemOptions['priceMode'],
) {
  if (mode === 'none') {
    return true;
  }
  const price = parseOptionalNumber(item.productPrice);
  if (mode === 'nonNegative') {
    return price !== undefined && price >= 0;
  }
  return item.giftFlag === true || (price !== undefined && price > 0);
}

export function hasValidSaleDraftItems(
  items: SaleDraftItem[] = [],
  options: SaleDraftItemOptions = {},
) {
  const {
    countField = 'count',
    priceMode = 'positive',
    requireSaleOutItem = false,
    requireWarehouse = true,
  } = options;

  return items.some((item) => {
    const count = parseOptionalNumber(item[countField]);
    return (
      hasValue(item.productId) &&
      (!requireWarehouse || hasValue(item.warehouseId)) &&
      (!requireSaleOutItem ||
        hasValue(item.saleOutItemId) ||
        hasValue(item.sourceOutItemId)) &&
      count !== undefined &&
      count > 0 &&
      hasValidPrice(item, priceMode)
    );
  });
}
