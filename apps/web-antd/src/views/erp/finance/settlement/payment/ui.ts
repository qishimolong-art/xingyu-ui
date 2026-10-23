import { financeValue } from '#/views/erp/finance/utils/finance-decimal';
import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';

export function formatFinancePaymentAmount(value?: number) {
  if (value === undefined || value === null) return '';
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getFinancePaymentPageSummary(
  rows: Array<
    Pick<
      ErpFinancePaymentApi.FinancePayment,
      'discountPrice' | 'paymentPrice' | 'totalPrice'
    >
  >,
) {
  let discountPrice = 0;
  let paymentPrice = 0;
  let totalPrice = 0;
  for (const row of rows) {
    totalPrice += financeValue(row.totalPrice || 0);
    discountPrice += financeValue(row.discountPrice || 0);
    paymentPrice += financeValue(row.paymentPrice || 0);
  }
  return {
    documentCount: rows.length,
    totalPrice,
    discountPrice,
    paymentPrice,
  };
}
