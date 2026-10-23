import { stockNatural as erpCountInputFormatter } from '#/views/erp/stock/utils/stock-decimal';

interface InputNumberFormatterInfo {
  input: string;
  userTyping: boolean;
}

/**
 * Keep decimal input editable while removing meaningless trailing zeros from
 * the initialized and blurred stock-check count display.
 */
export function formatStockCheckCountInput(
  value: null | number | string | undefined,
  info?: InputNumberFormatterInfo,
) {
  if (info?.userTyping) return info.input;
  if (value === null) return '';
  return erpCountInputFormatter(value);
}
