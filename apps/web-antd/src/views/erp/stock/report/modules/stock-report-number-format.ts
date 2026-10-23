import {
  stockNaturalGrouped,
  stockMoneyGrouped,
} from '../../utils/stock-decimal';
export function formatStockReportQuantity(
  value: unknown,
  _maximumFractionDigits?: number,
) {
  return stockNaturalGrouped(value as null | number | string | undefined);
}
export function formatStockReportMoney(value: unknown) {
  return stockMoneyGrouped(value as null | number | string | undefined);
}
