export const STOCK_SOURCE_DOCUMENT_TYPES = {
  PURCHASE_ORDER: 10,
  PURCHASE_IN: 11,
  PURCHASE_RETURN: 12,
  PURCHASE_PRICE_ADJUST: 13,
  SALE_ORDER: 20,
  SALE_OUT: 21,
  SALE_RETURN: 22,
  SALE_PRICE_ADJUST: 23,
} as const;

const SUPPORTED_SOURCE_TYPES = new Set<number>(
  Object.values(STOCK_SOURCE_DOCUMENT_TYPES),
);

export function canNavigateStockSourceDocument(
  sourceType?: null | number,
  sourceId?: null | number,
) {
  return Boolean(
    sourceId && sourceType && SUPPORTED_SOURCE_TYPES.has(sourceType),
  );
}
