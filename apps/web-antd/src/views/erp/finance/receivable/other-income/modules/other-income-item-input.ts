import { financeDecimal, financeMoney, financeValue } from '#/views/erp/finance/utils/finance-decimal';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';
import { erpCountInputFormatter } from '@vben/utils';

type ParseNumberResult =
  | { ok: false; message: string }
  | { ok: true; value: number | string };

export function parseOtherIncomeQtyText(
  text: unknown,
  fieldLabel = '单据数量',
): ParseNumberResult {
  const value = String(text ?? '').trim();
  if (!value) {
    return { ok: false, message: `${fieldLabel}不能为空` };
  }
  if (!/^\d+$/.test(value)) {
    return { ok: false, message: `${fieldLabel}必须为整数` };
  }
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) {
    return { ok: false, message: `${fieldLabel}必须为有效整数` };
  }
  return { ok: true, value: numberValue };
}

export function parseOtherIncomeAmountText(
  text: unknown,
  fieldLabel = '金额',
): ParseNumberResult {
  const value = String(text ?? '').trim();
  if (!value) {
    return { ok: false, message: `${fieldLabel}不能为空` };
  }
  if (!/^\d+(\.\d*)?$/.test(value)) {
    return { ok: false, message: `${fieldLabel}必须为数字` };
  }
  const numberValue = financeValue(value);
  if (!financeDecimal(numberValue).isFinite()) {
    return { ok: false, message: `${fieldLabel}必须为数字` };
  }
  return { ok: true, value: numberValue };
}

export function normalizeOtherIncomeAmount(value: number | string) {
  return financeValue(value);
}

export function formatOtherIncomeQtyInput(
  value: null | number | string | undefined,
) {
  return value === null || value === undefined
    ? ''
    : erpCountInputFormatter(value);
}

export function formatOtherIncomeAmountInput(
  value: null | number | string | undefined,
) {
  return value === null || value === undefined
    ? ''
    : financeMoney(value);
}
