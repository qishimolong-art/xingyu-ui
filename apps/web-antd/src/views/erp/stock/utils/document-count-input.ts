import { stockNatural as erpCountInputFormatter } from '#/views/erp/stock/utils/stock-decimal';

interface InputNumberFormatterInfo {
  input: string;
  userTyping: boolean;
}

/**
 * Keep decimal input editable while removing meaningless trailing zeros from
 * initialized and blurred stock-document quantities.
 */
export function formatStockDocumentCountInput(
  value: null | number | string | undefined,
  info?: InputNumberFormatterInfo,
) {
  if (info?.userTyping) return info.input;
  if (value === null || value === undefined || value === '') return '';
  return erpCountInputFormatter(value);
}
