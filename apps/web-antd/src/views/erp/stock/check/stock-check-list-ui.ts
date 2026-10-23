import { stockListNumber } from '../utils/stock-decimal';
export const STOCK_CHECK_APPROVED_STATUS = 20;

type StockCheckSummaryValue = null | number | string | undefined;

interface StockCheckStatusRow {
  status?: number;
}

/** Approved stock-check rows may be selected for export, but cannot be deleted. */
export function isStockCheckRowDeletable(row: StockCheckStatusRow) {
  return row.status !== STOCK_CHECK_APPROVED_STATUS;
}

export function formatStockCheckSummaryCount(value: StockCheckSummaryValue) {
  if (value === null || value === undefined) return '****';
  return stockListNumber(value);
}

export function formatStockCheckSummaryAmount(value: StockCheckSummaryValue) {
  if (value === null || value === undefined) return '****';
  return stockListNumber(value);
}
