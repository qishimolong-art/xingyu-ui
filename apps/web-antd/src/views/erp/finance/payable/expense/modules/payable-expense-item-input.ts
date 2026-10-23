import { financeDecimal, financeMoney, financeValue } from '#/views/erp/finance/utils/finance-decimal';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';
import { erpCountInputFormatter } from '@vben/utils';

type ParseNumberResult =
  | { ok: false; message: string }
  | { ok: true; value: number | string };

export function parsePayableExpenseQtyText(
  text: unknown,
  fieldLabel = '费用数量',
): ParseNumberResult {
  const value = String(text ?? '').trim();
  if (!value) return { ok: false, message: `${fieldLabel}不能为空` };
  if (!/^\d+$/.test(value)) {
    return { ok: false, message: `${fieldLabel}必须为正整数` };
  }
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
    return { ok: false, message: `${fieldLabel}必须为正整数` };
  }
  return { ok: true, value: numberValue };
}

export function parsePayableExpenseAmountText(
  text: unknown,
  fieldLabel = '费用金额',
): ParseNumberResult {
  const value = String(text ?? '').trim();
  if (!value) return { ok: false, message: `${fieldLabel}不能为空` };
  if (!/^\d+(\.\d*)?$/.test(value)) {
    return {
      ok: false,
      message: `${fieldLabel}必须为正数`,
    };
  }
  const numberValue = financeValue(value);
  if (!financeDecimal(numberValue).isFinite() || financeDecimal(numberValue).lte(0)) {
    return { ok: false, message: `${fieldLabel}必须大于 0` };
  }
  return { ok: true, value: numberValue };
}

export function normalizePayableExpenseAmount(value: number | string) {
  return financeValue(value);
}

export function formatPayableExpenseQtyInput(
  value: null | number | string | undefined,
) {
  return value === null || value === undefined
    ? ''
    : erpCountInputFormatter(value);
}

export function formatPayableExpenseAmountInput(
  value: null | number | string | undefined,
) {
  return value === null || value === undefined
    ? ''
    : financeMoney(value);
}
