import { erpCountInputFormatter } from '@vben/utils';

export const STOCK_SELECTION_DISTRIBUTION_ROW_CLASS =
  'stock-selection-sale-distribution-row';

interface StockVisibilityRow {
  readonlyBySaleDistribution?: boolean;
}

export function formatStockSelectionCount(value: unknown) {
  return erpCountInputFormatter(value as number | string | undefined);
}

export function normalizeSaleHistoryCount(
  value: unknown,
  documentType: 'return' | 'sale-out',
) {
  if (documentType !== 'return') {
    return value;
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  return numericValue === 0 ? 0 : -Math.abs(numericValue);
}

export function formatStockSelectionPrice<T extends object>(
  row: T,
  field: string,
) {
  const value = (row as Record<string, unknown>)[field];
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue)
    ? numberValue.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '';
}

export function isStockSelectionReadonly(
  row: StockVisibilityRow,
  saleDistributionReadonly: boolean,
) {
  return saleDistributionReadonly && row.readonlyBySaleDistribution === true;
}

export function getStockSelectionRowClassName(
  { row }: { row: StockVisibilityRow },
  saleDistributionReadonly: boolean,
) {
  return isStockSelectionReadonly(row, saleDistributionReadonly)
    ? STOCK_SELECTION_DISTRIBUTION_ROW_CLASS
    : '';
}
