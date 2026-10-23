import type { ErpSaleCartApi } from '#/api/erp/sale/cart';

export function buildSaleCartSubmitSuccessMessage(
  result: ErpSaleCartApi.SaleCartSubmitResult | boolean | null | undefined,
) {
  if (typeof result === 'object' && result?.status === 15) {
    return '提交成功，已进入待开单确认';
  }
  return '提交成功';
}

export function buildSaleCartConfirmSuccessMessage(
  result: ErpSaleCartApi.SaleCartSubmitResult | boolean | null | undefined,
) {
  if (typeof result === 'object' && result?.status === 20) {
    return '开单确认成功，已进入待初审';
  }
  if (typeof result === 'object' && result?.status === 30) {
    return '开单确认成功，已进入待终审';
  }
  return '开单确认成功';
}
