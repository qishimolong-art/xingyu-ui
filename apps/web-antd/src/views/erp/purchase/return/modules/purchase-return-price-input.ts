import { formatPurchaseAmount, formatPurchaseDecimal } from '../../utils/decimal';

export function normalizePurchaseReturnPrice(value: number) {
  return Number(formatPurchaseDecimal(value, '0'));
}

export function formatPurchaseReturnPriceInput(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return formatPurchaseAmount(value);
}
