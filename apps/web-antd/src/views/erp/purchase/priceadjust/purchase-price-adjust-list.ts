import type { ErpPurchasePriceAdjustApi } from '#/api/erp/purchase/priceadjust';

export type PurchasePriceAdjustAmountField =
  | 'adjustedTotalPrice'
  | 'originalTotalPrice'
  | 'paymentPrice'
  | 'totalAdjustPrice';

export function sumPurchasePriceAdjustAmount(
  rows: ErpPurchasePriceAdjustApi.PurchasePriceAdjust[],
  field: PurchasePriceAdjustAmountField,
) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

export function formatPurchasePriceAdjustAmount(value: number) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
