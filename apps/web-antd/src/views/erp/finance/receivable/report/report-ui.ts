import {
  financeValue,
  financeCompare,
} from '#/views/erp/finance/utils/finance-decimal';
import type { ErpReceivableReportApi } from '#/api/erp/finance/receivable/report';

export type ReceivableReportAmountField =
  | 'balance'
  | 'otherReceivableAmount'
  | 'settledAmount';

export function sumReceivableReportAmount(
  rows: ErpReceivableReportApi.ReceivableReport[],
  field: ReceivableReportAmountField,
) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

export function getReceivableReportDetailState(
  row: ErpReceivableReportApi.ReceivableReportDetail,
) {
  const increaseAmount = financeValue(row.increaseAmount || 0);
  const receiptAmount = financeValue(row.receiptAmount || 0);
  if (
    financeCompare(increaseAmount, 0) <= 0 ||
    financeCompare(receiptAmount, 0) <= 0
  )
    return 'unpaid';
  return financeCompare(receiptAmount, increaseAmount) >= 0
    ? 'settled'
    : 'partial';
}
