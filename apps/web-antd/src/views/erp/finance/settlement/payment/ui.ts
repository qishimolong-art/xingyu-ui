import { financeListMoney } from '#/views/erp/finance/utils/finance-decimal';
import { financeAdd } from '#/views/erp/finance/utils/finance-decimal';
import { financeValue } from '#/views/erp/finance/utils/finance-decimal';
import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';

export function formatFinancePaymentAmount(value?: number | string | null) {
  return financeListMoney(value);
}

export function getFinancePaymentPageSummary(
  rows: Array<
    Pick<
      ErpFinancePaymentApi.FinancePayment,
      'discountPrice' | 'paymentPrice' | 'totalPrice'
    >
  >,
) {
  let discountPrice = '0';
  let paymentPrice = '0';
  let totalPrice = '0';
  for (const row of rows) {
    totalPrice = financeAdd(totalPrice, financeValue(row.totalPrice || 0));
    discountPrice = financeAdd(
      discountPrice,
      financeValue(row.discountPrice || 0),
    );
    paymentPrice = financeAdd(
      paymentPrice,
      financeValue(row.paymentPrice || 0),
    );
  }
  return {
    documentCount: rows.length,
    totalPrice,
    discountPrice,
    paymentPrice,
  };
}
