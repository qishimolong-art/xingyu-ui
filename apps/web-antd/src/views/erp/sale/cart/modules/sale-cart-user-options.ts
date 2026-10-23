import type { ErpSaleCartApi } from '#/api/erp/sale/cart';

export interface SaleCartUserOption {
  id: number;
  nickname: string;
}

/**
 * 销售人员选择器只懒请求候选项，当前值必须从表单数据注入。
 * 这样即使当前人员不在第一页或不在当前权限结果里，也不会回退显示人员 ID。
 */
export function buildCurrentSaleUserOptions(
  formType: string,
  data?: ErpSaleCartApi.SaleCart,
): SaleCartUserOption[] {
  if (!formType || data?.saleUserId === undefined) {
    return [];
  }
  const nickname = (data.saleUserName || data.creatorName || '').trim();
  return nickname && `${nickname}` !== `${data.saleUserId}`
    ? [{ id: data.saleUserId, nickname }]
    : [];
}
