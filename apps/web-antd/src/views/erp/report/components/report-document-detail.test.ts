import { describe, expect, it, vi } from 'vitest';

import {
  REPORT_DOCUMENT_TYPES,
  resolveReportDocumentTarget,
} from './report-document-detail';

describe('报表单据详情目标', () => {
  it.each([
    ['FINANCE_PAYMENT', 'erp:finance-payment:query'],
    ['FINANCE_RECEIPT', 'erp:finance-receipt:query'],
    ['FINANCE_TRANSFER', 'erp:finance-transfer:query'],
    ['OTHER_INCOME', 'erp:receivable-other-income:query'],
    ['PAYABLE_EXPENSE', 'erp:payable-expense:query'],
    ['PAYABLE_MISC', 'erp:payable-misc:query'],
    ['PAYABLE_OTHER', 'erp:payable-other:query'],
    ['PURCHASE_ORDER', 'erp:purchase-order:query'],
    ['PURCHASE_IN', 'erp:purchase-in:query'],
    ['PURCHASE_INVOICE', 'erp:purchase-invoice:query'],
    ['PURCHASE_PRICE_ADJUST', 'erp:purchase-price-adjust:query'],
    ['PURCHASE_RETURN', 'erp:purchase-return:query'],
    ['RECEIVABLE_MISC', 'erp:receivable-misc:query'],
    ['RECEIVABLE_OTHER', 'erp:receivable-other:query'],
    ['SALE_CART', 'erp:sale-cart:query'],
    ['SALE_ORDER', 'erp:sale-order:query'],
    ['SALE_OUT', 'erp:sale-out:query'],
    ['SALE_PRICE_ADJUST', 'erp:sale-price-adjust:query'],
    ['SALE_QUOTE', 'erp:sale-quote:query'],
    ['SALE_RETURN', 'erp:sale-return:query'],
    ['STOCK_TRANSFER_IN', 'erp:stock-transfer-in:query'],
    ['STOCK_TRANSFER_OUT', 'erp:stock-transfer-out:query'],
  ] as const)('按 %s 映射原单查询权限', (type, permission) => {
    const access = vi.fn(() => true);

    expect(resolveReportDocumentTarget(type, 91, 'DJ-91', access)).toEqual({
      id: 91,
      permission,
      type,
    });
    expect(access).toHaveBeenCalledExactlyOnceWith([permission]);
  });

  it.each([
    [REPORT_DOCUMENT_TYPES.SALE_OUT, 91, undefined],
    [REPORT_DOCUMENT_TYPES.SALE_OUT, 91, ''],
    [REPORT_DOCUMENT_TYPES.SALE_OUT, 91, '   '],
    [REPORT_DOCUMENT_TYPES.SALE_OUT, undefined, 'DJ-91'],
    [REPORT_DOCUMENT_TYPES.SALE_OUT, 0, 'DJ-91'],
    [REPORT_DOCUMENT_TYPES.SALE_OUT, -1, 'DJ-91'],
    [REPORT_DOCUMENT_TYPES.SALE_OUT, 1.5, 'DJ-91'],
    [undefined, 91, 'DJ-91'],
    ['UNKNOWN', 91, 'DJ-91'],
  ] as const)('缺少可靠目标时保持普通文本：%j', (type, id, documentNo) => {
    expect(
      resolveReportDocumentTarget(type, id, documentNo, () => true),
    ).toBeUndefined();
  });

  it('没有原单查询权限时保持普通文本', () => {
    expect(
      resolveReportDocumentTarget(
        REPORT_DOCUMENT_TYPES.SALE_OUT,
        91,
        'DJ-91',
        () => false,
      ),
    ).toBeUndefined();
  });
});
