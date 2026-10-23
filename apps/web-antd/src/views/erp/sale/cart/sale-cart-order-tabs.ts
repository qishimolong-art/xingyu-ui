export const SALE_CART_ORDER_TAB = {
  ONLINE_ORDER: 'onlineOrder',
  SALE_CART: 'saleCart',
} as const;

export type SaleCartOrderTab =
  (typeof SALE_CART_ORDER_TAB)[keyof typeof SALE_CART_ORDER_TAB];

export function buildSaleCartOrderSourceParams(tab: SaleCartOrderTab) {
  return {
    onlineOrder: tab === SALE_CART_ORDER_TAB.ONLINE_ORDER,
  };
}

export function canCreateSaleCart(tab: SaleCartOrderTab) {
  return tab === SALE_CART_ORDER_TAB.SALE_CART;
}
