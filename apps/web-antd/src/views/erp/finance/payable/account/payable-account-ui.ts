import {
  financeValue,
  financeCompare,
  financeAbs,
  financeAdd,
} from '#/views/erp/finance/utils/finance-decimal';
import type { ErpPayableAccountApi } from '#/api/erp/finance/payable/account';

export type PayableDetailPaymentState = 'partial' | 'settled' | 'unpaid';

function isPaymentDetailRow(row: ErpPayableAccountApi.PayableDetail) {
  return Boolean(
    !row.bizType &&
    financeCompare(financeValue(row.paymentAmount || 0), 0) !== 0 &&
    financeCompare(financeValue(row.increaseAmount || 0), 0) <= 0 &&
    financeCompare(financeValue(row.writeOffAmount || 0), 0) <= 0,
  );
}

/**
 * 付款单行按付款单自身核销进度判断；业务单据行按已关联的有效付款核销金额判断。
 * 没有付款/核销的流水保持白底，旧核销流水仍沿用余额口径区分部分与完成。
 */
export function getPayableDetailPaymentState(
  row: ErpPayableAccountApi.PayableDetail,
): PayableDetailPaymentState {
  if (isPaymentDetailRow(row)) {
    const allocatedAmount =
      row.allocatedAmount === undefined || row.allocatedAmount === null
        ? undefined
        : financeAbs(financeValue(row.allocatedAmount || 0));
    if (
      allocatedAmount === undefined ||
      financeCompare(allocatedAmount, 0) <= 0
    ) {
      return 'partial';
    }
    return financeCompare(
      allocatedAmount,
      financeAbs(financeValue(row.paymentAmount || 0)),
    ) >= 0
      ? 'settled'
      : 'partial';
  }

  if (row.allocatedAmount !== undefined && row.allocatedAmount !== null) {
    const allocatedAmount = financeAbs(financeValue(row.allocatedAmount || 0));
    const documentAmount =
      row.writeOffBaseAmount === undefined || row.writeOffBaseAmount === null
        ? financeAbs(
            financeAdd(
              financeValue(row.increaseAmount || 0),
              financeValue(row.paymentAmount || 0),
            ),
          )
        : financeAbs(financeValue(row.writeOffBaseAmount || 0));
    if (financeCompare(allocatedAmount, 0) <= 0) return 'unpaid';
    return financeCompare(allocatedAmount, documentAmount) >= 0
      ? 'settled'
      : 'partial';
  }
  const settledAmount = financeAdd(
    financeValue(row.paymentAmount ?? 0),
    financeValue(row.writeOffAmount ?? 0),
  );
  if (financeCompare(settledAmount, 0) <= 0) return 'unpaid';
  return financeCompare(financeValue(row.balance ?? 0), 0) <= 0
    ? 'settled'
    : 'partial';
}

export function sumPayableAccountAmount(
  rows: ErpPayableAccountApi.PayableAccount[],
  field: keyof ErpPayableAccountApi.PayableAccount,
) {
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}
