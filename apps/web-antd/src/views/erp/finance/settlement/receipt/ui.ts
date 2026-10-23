import { financeListMoney } from '#/views/erp/finance/utils/finance-decimal';
import { financeAdd } from '#/views/erp/finance/utils/finance-decimal';
import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';

function normalizeDatePickerTimestamp(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : String(value.getTime());
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return undefined;
  }
  if (/^\d+$/.test(normalizedValue)) {
    return normalizedValue;
  }
  const timestamp = Date.parse(normalizedValue);
  return Number.isNaN(timestamp) ? undefined : String(timestamp);
}

export function normalizeFinanceReceiptFormDates(
  receipt: ErpFinanceReceiptApi.FinanceReceipt,
): ErpFinanceReceiptApi.FinanceReceipt {
  return {
    ...receipt,
    receiptTime: normalizeDatePickerTimestamp(receipt.receiptTime) as string,
    createTime: normalizeDatePickerTimestamp(receipt.createTime),
    updateTime: normalizeDatePickerTimestamp(receipt.updateTime),
  };
}

export function toFinanceReceiptDisplayDate(
  value: Date | number | string | undefined,
) {
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

export function formatFinanceReceiptAmount(value?: number | string | null) {
  return financeListMoney(value);
}

export function getFinanceReceiptPageSummary(
  rows: Array<
    Pick<
      ErpFinanceReceiptApi.FinanceReceipt,
      'discountPrice' | 'receiptPrice' | 'totalPrice'
    >
  >,
) {
  let discountPrice = '0';
  let receiptPrice = '0';
  let totalPrice = '0';
  for (const row of rows) {
    totalPrice = financeAdd(totalPrice, row.totalPrice || 0);
    discountPrice = financeAdd(discountPrice, row.discountPrice || 0);
    receiptPrice = financeAdd(receiptPrice, row.receiptPrice || 0);
  }
  return {
    documentCount: rows.length,
    totalPrice,
    discountPrice,
    receiptPrice,
  };
}
