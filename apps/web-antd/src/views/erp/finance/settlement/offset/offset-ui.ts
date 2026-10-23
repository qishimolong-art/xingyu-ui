import {
  financeCompare,
  financeValue,
  financeAbs,
  financeAdd,
} from '#/views/erp/finance/utils/finance-decimal';
export type OffsetDirection = 'balanced' | 'payable' | 'receivable';
export type OffsetSettlementState = 'partial' | 'settled' | 'unsettled';

export interface OffsetSettlementStateMeta {
  color: 'green' | 'orange' | 'red';
  label: string;
}

export function getOffsetDirection(value: unknown): OffsetDirection {
  const amount = Number(value || 0);
  if (financeCompare(amount, 0) > 0) return 'receivable';
  if (financeCompare(amount, 0) < 0) return 'payable';
  return 'balanced';
}

export function getOffsetDirectionLabel(direction: OffsetDirection) {
  if (direction === 'receivable') return '净应收';
  if (direction === 'payable') return '净应付';
  return '已平衡';
}

function getSettlementState(
  settledAmount: number | string | null,
  balance: unknown,
): OffsetSettlementState {
  if (financeCompare(settledAmount, 0) <= 0) return 'unsettled';
  return financeCompare(financeValue(balance ?? 0), 0) <= 0
    ? 'settled'
    : 'partial';
}

export function getReceivableSettlementState(row: {
  allocatedAmount?: number | string | null;
  balance?: number | string | null;
  increaseAmount?: number | string | null;
  receiptAmount?: number | string | null;
  writeOffBaseAmount?: number | string | null;
  writeOffAmount?: number | string | null;
}): OffsetSettlementState {
  if (row.allocatedAmount !== undefined && row.allocatedAmount !== null) {
    const allocatedAmount = financeAbs(financeValue(row.allocatedAmount || 0));
    const documentAmount =
      row.writeOffBaseAmount === undefined || row.writeOffBaseAmount === null
        ? financeAbs(
            financeAdd(
              financeValue(row.increaseAmount || 0),
              financeValue(row.receiptAmount || 0),
            ),
          )
        : financeAbs(financeValue(row.writeOffBaseAmount || 0));
    if (financeCompare(allocatedAmount, 0) <= 0) return 'unsettled';
    return financeCompare(allocatedAmount, documentAmount) >= 0
      ? 'settled'
      : 'partial';
  }
  return getSettlementState(
    financeAdd(
      financeValue(row.receiptAmount ?? 0),
      financeValue(row.writeOffAmount ?? 0),
    ),
    row.balance,
  );
}

export function getPayableSettlementState(row: {
  allocatedAmount?: number | string | null;
  balance?: number | string | null;
  increaseAmount?: number | string | null;
  paymentAmount?: number | string | null;
  writeOffBaseAmount?: number | string | null;
  writeOffAmount?: number | string | null;
}): OffsetSettlementState {
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
    if (financeCompare(allocatedAmount, 0) <= 0) return 'unsettled';
    return financeCompare(allocatedAmount, documentAmount) >= 0
      ? 'settled'
      : 'partial';
  }
  return getSettlementState(
    financeAdd(
      financeValue(row.paymentAmount ?? 0),
      financeValue(row.writeOffAmount ?? 0),
    ),
    row.balance,
  );
}

export function getReceivableSettlementStateMeta(
  state: OffsetSettlementState,
): OffsetSettlementStateMeta {
  if (state === 'settled') return { color: 'green', label: '已收款' };
  if (state === 'partial') return { color: 'orange', label: '部分收款' };
  return { color: 'red', label: '未收款' };
}

export function getPayableSettlementStateMeta(
  state: OffsetSettlementState,
): OffsetSettlementStateMeta {
  if (state === 'settled') return { color: 'green', label: '已付款' };
  if (state === 'partial') return { color: 'orange', label: '部分付款' };
  return { color: 'red', label: '未付款' };
}
