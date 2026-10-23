import { formatPurchaseDecimal } from '../../utils/decimal';

interface InputNumberFormatterInfo {
  input: string;
  userTyping: boolean;
}

/**
 * Keep decimal input editable while removing meaningless trailing zeros from
 * the initialized and blurred purchase-invoice count display.
 */
export function formatPurchaseInvoiceCountInput(
  value: null | number | string | undefined,
  info?: InputNumberFormatterInfo,
) {
  if (info?.userTyping) return info.input;
  if (value === null || value === undefined || value === '') return '';
  return formatPurchaseDecimal(value);
}
