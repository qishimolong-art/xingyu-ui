import {
  financeValue,
  financeListMoney,
} from '#/views/erp/finance/utils/finance-decimal';
import { financeIsFinite } from '#/views/erp/finance/utils/finance-decimal';
import { financeAdd } from '#/views/erp/finance/utils/finance-decimal';
import type { ErpFinanceTransferApi } from '#/api/erp/finance/transfer';

function toFiniteAmount(value?: number | string | null) {
  try { return value == null || value === '' ? '0' : financeValue(value); } catch { return '0'; }
}

export function formatBankTransferAmount(value?: number | string | null) {
  return financeListMoney(value);
}

export function sumBankTransferAmount(
  rows: ErpFinanceTransferApi.FinanceTransfer[],
) {
  return rows.reduce(
    (total, row) => financeAdd(total, toFiniteAmount(row.transferPrice)),
    '0',
  );
}

export function getBankTransferPageSummary(
  rows: ErpFinanceTransferApi.FinanceTransfer[],
) {
  return {
    approvedCount: rows.filter((row) => row.status === 20).length,
    documentCount: rows.length,
    draftCount: rows.filter((row) => row.status === 0).length,
    pendingCount: rows.filter((row) => row.status === 10).length,
    transferAmount: sumBankTransferAmount(rows),
  };
}
