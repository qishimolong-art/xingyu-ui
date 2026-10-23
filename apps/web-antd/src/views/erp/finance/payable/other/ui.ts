import {
  financeValue,
  financeListMoney,
} from '#/views/erp/finance/utils/finance-decimal';
import { financeIsFinite } from '#/views/erp/finance/utils/finance-decimal';
import {
  financeAdd,
  financeSubtract,
} from '#/views/erp/finance/utils/finance-decimal';
import type { ErpPayableOtherApi } from '#/api/erp/finance/payable/other';

export type OtherPayableAmountField =
  | 'increasePayableAmount'
  | 'payableAmount'
  | 'settledAmount';

export function normalizeOtherPayableBizDate(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    if ([year, month, day].every((item) => Number.isInteger(item))) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return String(value).slice(0, 10);
}

function toFiniteAmount(value?: number | string | null) {
  try { return value == null || value === '' ? '0' : financeValue(value); } catch { return '0'; }
}

export function formatOtherPayableAmount(value?: number | string | null) {
  return financeListMoney(value);
}

export function sumOtherPayableAmount(
  rows: ErpPayableOtherApi.PayableOther[],
  field: OtherPayableAmountField,
) {
  return rows.reduce(
    (total, row) => financeAdd(total, toFiniteAmount(row[field])),
    '0',
  );
}

export function getOtherPayablePageSummary(
  rows: ErpPayableOtherApi.PayableOther[],
) {
  const payableAmount = sumOtherPayableAmount(rows, 'payableAmount');
  const settledAmount = sumOtherPayableAmount(rows, 'settledAmount');
  return {
    documentCount: rows.length,
    outstandingAmount: financeSubtract(payableAmount, settledAmount),
    payableAmount,
    settledAmount,
  };
}
