export const REPORT_DOCUMENT_TYPES = {
  FINANCE_PAYMENT: 'FINANCE_PAYMENT',
  FINANCE_RECEIPT: 'FINANCE_RECEIPT',
  FINANCE_TRANSFER: 'FINANCE_TRANSFER',
  OTHER_INCOME: 'OTHER_INCOME',
  PAYABLE_EXPENSE: 'PAYABLE_EXPENSE',
  PAYABLE_MISC: 'PAYABLE_MISC',
  PAYABLE_OTHER: 'PAYABLE_OTHER',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  PURCHASE_IN: 'PURCHASE_IN',
  PURCHASE_INVOICE: 'PURCHASE_INVOICE',
  PURCHASE_PRICE_ADJUST: 'PURCHASE_PRICE_ADJUST',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  RECEIVABLE_MISC: 'RECEIVABLE_MISC',
  RECEIVABLE_OTHER: 'RECEIVABLE_OTHER',
  SALE_CART: 'SALE_CART',
  SALE_ORDER: 'SALE_ORDER',
  SALE_OUT: 'SALE_OUT',
  SALE_PRICE_ADJUST: 'SALE_PRICE_ADJUST',
  SALE_QUOTE: 'SALE_QUOTE',
  SALE_RETURN: 'SALE_RETURN',
  STOCK_TRANSFER_IN: 'STOCK_TRANSFER_IN',
  STOCK_TRANSFER_OUT: 'STOCK_TRANSFER_OUT',
} as const;

export type ReportDocumentType =
  (typeof REPORT_DOCUMENT_TYPES)[keyof typeof REPORT_DOCUMENT_TYPES];

export interface ReportDocumentTarget {
  id: number;
  permission: string;
  type: ReportDocumentType;
}

const DOCUMENT_PERMISSIONS: Record<ReportDocumentType, string> = {
  FINANCE_PAYMENT: 'erp:finance-payment:query',
  FINANCE_RECEIPT: 'erp:finance-receipt:query',
  FINANCE_TRANSFER: 'erp:finance-transfer:query',
  OTHER_INCOME: 'erp:receivable-other-income:query',
  PAYABLE_EXPENSE: 'erp:payable-expense:query',
  PAYABLE_MISC: 'erp:payable-misc:query',
  PAYABLE_OTHER: 'erp:payable-other:query',
  PURCHASE_ORDER: 'erp:purchase-order:query',
  PURCHASE_IN: 'erp:purchase-in:query',
  PURCHASE_INVOICE: 'erp:purchase-invoice:query',
  PURCHASE_PRICE_ADJUST: 'erp:purchase-price-adjust:query',
  PURCHASE_RETURN: 'erp:purchase-return:query',
  RECEIVABLE_MISC: 'erp:receivable-misc:query',
  RECEIVABLE_OTHER: 'erp:receivable-other:query',
  SALE_CART: 'erp:sale-cart:query',
  SALE_ORDER: 'erp:sale-order:query',
  SALE_OUT: 'erp:sale-out:query',
  SALE_PRICE_ADJUST: 'erp:sale-price-adjust:query',
  SALE_QUOTE: 'erp:sale-quote:query',
  SALE_RETURN: 'erp:sale-return:query',
  STOCK_TRANSFER_IN: 'erp:stock-transfer-in:query',
  STOCK_TRANSFER_OUT: 'erp:stock-transfer-out:query',
};

export function getReportDocumentPermission(type: ReportDocumentType) {
  return DOCUMENT_PERMISSIONS[type];
}

export function isReportDocumentType(
  type: null | string | undefined,
): type is ReportDocumentType {
  return Boolean(type && type in DOCUMENT_PERMISSIONS);
}

export function resolveReportDocumentTarget(
  type: null | string | undefined,
  id: null | number | undefined,
  documentNo: null | string | undefined,
  hasAccessByCodes: (codes: string[]) => boolean,
): ReportDocumentTarget | undefined {
  if (
    !isReportDocumentType(type) ||
    !Number.isSafeInteger(id) ||
    Number(id) <= 0 ||
    !documentNo?.trim()
  ) {
    return undefined;
  }
  const permission = DOCUMENT_PERMISSIONS[type];
  if (!hasAccessByCodes([permission])) return undefined;
  return { id: Number(id), permission, type };
}
