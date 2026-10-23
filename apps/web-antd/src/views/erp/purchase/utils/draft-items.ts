import { parseOptionalNumber } from './text-number';

type PurchaseDraftItem = {
  count?: unknown;
  inItemId?: unknown;
  newPrice?: unknown;
  productId?: unknown;
  sourceInItemId?: unknown;
  warehouseId?: unknown;
};

type PurchaseDraftItemOptions = {
  requireNewPrice?: boolean;
  requireSourceInItem?: boolean;
  requireWarehouse?: boolean;
};

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

export function hasValidPurchaseDraftItems(
  items: PurchaseDraftItem[] = [],
  options: PurchaseDraftItemOptions = {},
) {
  const {
    requireNewPrice = false,
    requireSourceInItem = false,
    requireWarehouse = true,
  } = options;

  return items.some((item) => {
    const count = parseOptionalNumber(item.count);
    const newPrice = parseOptionalNumber(item.newPrice);
    return (
      hasValue(item.productId) &&
      (!requireWarehouse || hasValue(item.warehouseId)) &&
      (!requireSourceInItem ||
        hasValue(item.sourceInItemId) ||
        hasValue(item.inItemId)) &&
      (!requireNewPrice || (newPrice !== undefined && newPrice >= 0)) &&
      count !== undefined &&
      count > 0
    );
  });
}
