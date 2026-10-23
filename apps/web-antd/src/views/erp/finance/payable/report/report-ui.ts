import {
  financeValue,
  financeCompare,
} from '#/views/erp/finance/utils/finance-decimal';
import type { ErpPayableReportApi } from '#/api/erp/finance/payable/report';

export type PayableReportAmountField =
  | 'balance'
  | 'otherPayableAmount'
  | 'settledAmount';

export function sumPayableReportAmount(
  rows: ErpPayableReportApi.PayableReport[],
  field: PayableReportAmountField,
) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

export function getPayableReportDetailState(
  row: ErpPayableReportApi.PayableReportDetail,
) {
  const increaseAmount = financeValue(row.increaseAmount || 0);
  const paymentAmount = financeValue(row.paymentAmount || 0);
  if (
    financeCompare(increaseAmount, 0) <= 0 ||
    financeCompare(paymentAmount, 0) <= 0
  )
    return 'unpaid';
  return financeCompare(paymentAmount, increaseAmount) >= 0
    ? 'settled'
    : 'partial';
}
