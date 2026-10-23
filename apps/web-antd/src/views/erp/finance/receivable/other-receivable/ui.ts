import { financeAdd, financeSubtract } from '#/views/erp/finance/utils/finance-decimal';
import type { ErpReceivableOtherApi } from '#/api/erp/finance/receivable/other-receivable';

export type OtherReceivableAmountField =
  | 'increaseReceivableAmount'
  | 'receivableAmount'
  | 'settledAmount';

export function normalizeOtherReceivableBizDate(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    if ([year, month, day].every((item) => Number.isInteger(item))) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return String(value).slice(0, 10);
}

export function formatOtherReceivableAmount(value?: number) {
  return (value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function sumOtherReceivableAmount(
  rows: ErpReceivableOtherApi.OtherReceivable[],
  field: OtherReceivableAmountField,
) {
  return rows.reduce((total, row) => financeAdd(total, row[field] || 0), 0);
}

export function getOtherReceivablePageSummary(
  rows: ErpReceivableOtherApi.OtherReceivable[],
) {
  const receivableAmount = sumOtherReceivableAmount(rows, 'receivableAmount');
  const settledAmount = sumOtherReceivableAmount(rows, 'settledAmount');
  return {
    documentCount: rows.length,
    outstandingAmount: financeSubtract(receivableAmount, settledAmount),
    receivableAmount,
    settledAmount,
  };
}
