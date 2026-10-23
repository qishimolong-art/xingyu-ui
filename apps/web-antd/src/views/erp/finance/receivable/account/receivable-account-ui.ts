import { financeValue, financeCompare, financeAbs, financeAdd } from '#/views/erp/finance/utils/finance-decimal';
import type { ErpReceivableAccountApi } from '#/api/erp/finance/receivable/account';

export type ReceivableStatusColor = 'green' | 'orange' | 'red';
export type ReceivableDetailPaymentState = 'partial' | 'settled' | 'unpaid';

export function getReceivableStatusMeta(
  row: ErpReceivableAccountApi.ReceivableAccount,
): { color: ReceivableStatusColor; label: string } {
  const unreceivedAmount = financeValue(row.unreceivedAmount ?? row.receivableBalance ?? 0);
  const receivedAmount = financeValue(row.receivedAmount ?? 0);
  if ((financeCompare(unreceivedAmount, 0) > 0) && (financeCompare(receivedAmount, 0) <= 0)) {
    return { color: 'red', label: '未收款' };
  }
  if ((financeCompare(unreceivedAmount, 0) > 0)) {
    return { color: 'orange', label: '部分收款' };
  }
  return { color: 'green', label: '已收款' };
}

export function sumReceivableAccountAmount(
  rows: ErpReceivableAccountApi.ReceivableAccount[],
  field: keyof ErpReceivableAccountApi.ReceivableAccount,
) {
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

function isReceiptDetailRow(row: ErpReceivableAccountApi.ReceivableDetail) {
  return Boolean(
    !row.bizType &&
    (financeCompare(financeValue(row.receiptAmount || 0), 0) !== 0) &&
    (financeCompare(financeValue(row.increaseAmount || 0), 0) <= 0) &&
    (financeCompare(financeValue(row.otherReceivableAmount || 0), 0) <= 0) &&
    (financeCompare(financeValue(row.writeOffAmount || 0), 0) <= 0),
  );
}

/**
 * 明细行表达的是一次账务变动：没有收款/核销保持白底；发生过收款或核销后，
 * 根据该笔变动后的余额区分部分结算与已结清。
 */
export function getReceivableDetailPaymentState(
  row: ErpReceivableAccountApi.ReceivableDetail,
): ReceivableDetailPaymentState {
  if (isReceiptDetailRow(row)) {
    const allocatedAmount =
      row.allocatedAmount === undefined || row.allocatedAmount === null
        ? undefined
        : financeAbs(financeValue(row.allocatedAmount || 0));
    if (allocatedAmount === undefined || (financeCompare(allocatedAmount, 0) <= 0)) {
      return 'partial';
    }
    return (financeCompare(allocatedAmount, financeAbs(financeValue(row.receiptAmount || 0))) >= 0)
      ? 'settled'
      : 'partial';
  }

  if (row.allocatedAmount !== undefined && row.allocatedAmount !== null) {
    const allocatedAmount = financeAbs(financeValue(row.allocatedAmount || 0));
    const documentAmount =
      row.writeOffBaseAmount === undefined || row.writeOffBaseAmount === null
        ? financeAbs(financeAdd(financeAdd(financeValue(row.increaseAmount || 0), financeValue(row.otherReceivableAmount || 0)), financeValue(row.receiptAmount || 0)))
        : financeAbs(financeValue(row.writeOffBaseAmount || 0));
    if ((financeCompare(allocatedAmount, 0) <= 0)) return 'unpaid';
    return (financeCompare(allocatedAmount, documentAmount) >= 0) ? 'settled' : 'partial';
  }
  const settledAmount =
    financeAdd(financeValue(row.receiptAmount ?? 0), financeValue(row.writeOffAmount ?? 0));
  if ((financeCompare(settledAmount, 0) <= 0)) return 'unpaid';
  return (financeCompare(financeValue(row.balance ?? 0), 0) <= 0) ? 'settled' : 'partial';
}
