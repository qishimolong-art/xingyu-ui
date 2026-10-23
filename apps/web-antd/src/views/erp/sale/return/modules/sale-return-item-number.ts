import {
  formatSaleAmount,
  formatSaleDecimal,
  parseSaleDecimal,
} from '../../utils/decimal';

const SALE_RETURN_DECIMAL_DIGIT = 6;

export type SaleReturnNumberParseResult =
  | { ok: false; message: string }
  | { ok: true; value: number };

export function parseSaleReturnNumberText(
  text: unknown,
  fieldLabel: string,
  decimalDigits = SALE_RETURN_DECIMAL_DIGIT,
): SaleReturnNumberParseResult {
  const value = String(text ?? '').trim();
  if (!value) {
    return { ok: false, message: `${fieldLabel}不能为空` };
  }
  const matched = value.match(/^\d+(?:\.(\d*))?$/);
  if (!matched) {
    return { ok: false, message: `${fieldLabel}必须为数字` };
  }
  if ((matched[1]?.length ?? 0) > decimalDigits) {
    return {
      ok: false,
      message: `${fieldLabel}最多保留${decimalDigits}位小数`,
    };
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return { ok: false, message: `${fieldLabel}必须为数字` };
  }
  return { ok: true, value: numberValue };
}

export function normalizeSaleReturnCount(value: number) {
  return Number(formatSaleDecimal(value, '0'));
}

export function normalizeSaleReturnPrice(value: number) {
  const parsed = parseSaleDecimal(value, '单价');
  return parsed.ok ? Number(parsed.value || 0) : 0;
}

export function formatSaleReturnCountInput(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return formatSaleDecimal(normalizeSaleReturnCount(Number(value)));
}

export function formatSaleReturnPriceInput(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return formatSaleAmount(Number(value));
}
