import { financeAdd } from '#/views/erp/finance/utils/finance-decimal';
import type { ErpPayableExpenseApi } from '#/api/erp/finance/payable/expense';

export function formatPayableExpenseAmount(value: unknown) {
  return Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function normalizePayableExpenseDate(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  if (!Array.isArray(value) || value.length < 3) {
    return undefined;
  }

  const year = Number(value[0]);
  const month = Number(value[1]);
  const day = Number(value[2]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return undefined;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getPayableExpensePageSummary(
  rows: ErpPayableExpenseApi.PayableExpense[],
) {
  return {
    documentCount: rows.length,
    totalAmount: rows.reduce(
      (sum, row) => financeAdd(sum, row.totalAmount || 0),
      '0',
    ),
  };
}

export function normalizePayableExpenseListRow(
  row: ErpPayableExpenseApi.PayableExpense,
): ErpPayableExpenseApi.PayableExpense {
  return {
    ...row,
    auditorName: row.status === 20 ? row.updaterName : undefined,
    auditTime: row.status === 20 ? row.updateTime : undefined,
  };
}
