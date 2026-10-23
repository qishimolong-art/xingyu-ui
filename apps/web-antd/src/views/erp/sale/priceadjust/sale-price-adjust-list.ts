import type { ErpSalePriceAdjustApi } from '#/api/erp/sale/priceadjust';

/** 补齐列表派生字段，并兼容尚未独立保存审核信息的历史销售调价单。 */
export function normalizePriceAdjustListRow(
  row: ErpSalePriceAdjustApi.PriceAdjust,
): ErpSalePriceAdjustApi.PriceAdjust {
  const taxPrice = Number(row.taxPrice || 0);
  return {
    ...row,
    taxPrice,
    taxExclusiveAdjustPrice:
      row.taxExclusiveAdjustPrice ??
      Number(row.totalAdjustPrice || 0) - taxPrice,
    auditorName:
      row.auditorName ?? (row.status === 20 ? row.updaterName : undefined),
    approveTime:
      row.approveTime ?? (row.status === 20 ? row.updateTime : undefined),
  };
}
