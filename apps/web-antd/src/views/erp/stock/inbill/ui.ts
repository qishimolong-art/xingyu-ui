import type { ErpStockInBillApi } from '#/api/erp/stock/inbill';

import {
  stockDecimal,
  stockListNumber,
  stockSubtract,
  stockSum,
} from '../utils/stock-decimal';

export const STOCK_IN_BILL_STATUS_OPTIONS = [
  { label: '待提货', value: 10 },
  { label: '部分提货', value: 20 },
  { label: '已完成', value: 30 },
];

const STOCK_IN_BILL_STATUS_META = {
  10: { color: 'orange', label: '待提货' },
  20: { color: 'blue', label: '部分提货' },
  30: { color: 'green', label: '已完成' },
} as const;

export interface StockInBillPageRow extends ErpStockInBillApi.StockInBill {
  remainingCount?: null | number | string;
}

export function getStockInBillStatusMeta(status?: number) {
  return (
    STOCK_IN_BILL_STATUS_META[
      status as keyof typeof STOCK_IN_BILL_STATUS_META
    ] ?? { color: 'default', label: '未知状态' }
  );
}

export function getStockInBillRemainingCount(
  totalCount?: null | number | string,
  pickedCount?: null | number | string,
) {
  if (
    totalCount === null ||
    totalCount === undefined ||
    pickedCount === null ||
    pickedCount === undefined
  )
    return undefined;
  if (
    !Number.isFinite(Number(totalCount)) ||
    !Number.isFinite(Number(pickedCount))
  )
    return undefined;
  return stockDecimal(stockSubtract(totalCount, pickedCount)).lt(0)
    ? '0'
    : stockSubtract(totalCount, pickedCount);
}

export function getStockInBillProgress(
  totalCount?: null | number | string,
  pickedCount?: null | number | string,
) {
  if (
    totalCount === null ||
    totalCount === undefined ||
    pickedCount === null ||
    pickedCount === undefined
  )
    return undefined;
  if (
    !Number.isFinite(Number(totalCount)) ||
    !Number.isFinite(Number(pickedCount))
  )
    return undefined;
  const total = Number(totalCount);
  if (total <= 0) return 0;
  return Math.min(
    Math.max(Math.round((Number(pickedCount || 0) / total) * 100), 0),
    100,
  );
}

export function formatStockInBillCount(value?: null | number | string) {
  return stockListNumber(value);
}

export function normalizeStockInBillRow(
  row: ErpStockInBillApi.StockInBill,
): StockInBillPageRow {
  return {
    ...row,
    remainingCount: getStockInBillRemainingCount(
      row.totalCount,
      row.pickedCount,
    ),
  };
}

export function sumStockInBillCount(
  rows: ErpStockInBillApi.StockInBill[],
  field: 'pickedCount' | 'totalCount',
) {
  return stockSum(rows.map((row) => row[field] ?? '0'));
}

export function normalizeStockInBillSearchParams(values: Record<string, any>) {
  const params = { ...values };
  for (const field of [
    'keyword',
    'no',
    'pickupUserName',
    'sourceNo',
    'sourceUnitName',
  ]) {
    if (typeof params[field] === 'string') {
      const normalized = params[field].trim().replaceAll(/\s+/g, '%');
      params[field] = normalized || undefined;
    }
  }
  return params;
}
