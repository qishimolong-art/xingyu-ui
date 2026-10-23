const DECIMAL_DRAFT_PATTERN = /^\d{0,18}(?:\.\d{0,6})?$/;
const DECIMAL_VALUE_PATTERN = /^\d{1,18}(?:\.\d{1,6})?$/;

export interface DecimalValidationOptions {
  allowZero?: boolean;
  label: string;
}

export type DecimalValidationResult =
  | { message: string; ok: false }
  | { ok: true; value: number };

/** 输入过程允许空值和末尾小数点，便于用户连续录入。 */
export function isAssemblyDecimalDraft(value: unknown) {
  return DECIMAL_DRAFT_PATTERN.test(String(value ?? '').trim());
}

export function validateAssemblyDecimal(
  value: unknown,
  options: DecimalValidationOptions,
): DecimalValidationResult {
  const text = String(value ?? '').trim();
  if (!text) {
    return { ok: false, message: `${options.label}不能为空` };
  }
  if (!DECIMAL_VALUE_PATTERN.test(text)) {
    return {
      ok: false,
      message: `${options.label}最多支持 18 位整数和 6 位小数`,
    };
  }
  const number = Number(text);
  if (!Number.isFinite(number)) {
    return { ok: false, message: `${options.label}必须为有效数字` };
  }
  if (options.allowZero ? number < 0 : number <= 0) {
    return {
      ok: false,
      message: options.allowZero
        ? `${options.label}不能小于 0`
        : `${options.label}必须大于 0`,
    };
  }
  return { ok: true, value: number };
}

/** 数量等非金额字段：保留有效小数，移除无意义的末尾 0。 */
export function formatAssemblyNaturalDecimal(
  value: null | number | string | undefined,
  emptyText = '',
) {
  if (value === null || value === undefined || value === '') return emptyText;
  let text =
    typeof value === 'number' && Number.isFinite(value)
      ? value.toFixed(6)
      : String(value).trim();
  if (!text) return emptyText;
  if (/e/i.test(text)) {
    const number = Number(text);
    if (!Number.isFinite(number)) return emptyText;
    text = number.toFixed(6);
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return emptyText;
  const [integer = '0', fraction = ''] = text.split('.');
  const negative = integer.startsWith('-');
  const unsignedInteger = negative ? integer.slice(1) : integer;
  const normalizedUnsignedInteger =
    unsignedInteger.replace(/^0+(?=\d)/, '') || '0';
  const normalizedInteger = `${negative ? '-' : ''}${normalizedUnsignedInteger}`;
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction
    ? `${normalizedInteger}.${normalizedFraction}`
    : normalizedInteger;
}

/** 金额输入：至少两位小数，超过两位时保留至最后一位有效小数。 */
export function formatAssemblyAmountInput(
  value: null | number | string | undefined,
) {
  const normalized = formatAssemblyNaturalDecimal(value, '0');
  const [integer = '0', fraction = ''] = normalized.split('.');
  if (!fraction) return `${integer}.00`;
  if (fraction.length === 1) return `${integer}.${fraction}0`;
  return `${integer}.${fraction}`;
}

/** 列表、明细表和只读汇总中的金额统一保留两位小数。 */
export function formatAssemblyAmountList(
  value: null | number | string | undefined,
  emptyText = '-',
) {
  if (value === null || value === undefined || value === '') return emptyText;
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : emptyText;
}

export function isAssemblyPositiveIntegerDraft(value: unknown) {
  return /^\d*$/.test(String(value ?? '').trim());
}

export function validateAssemblyPositiveInteger(
  value: unknown,
  label = '组装套数',
) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) {
    return { ok: false as const, message: `${label}必须是正整数` };
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0 || number > 2_147_483_647) {
    return { ok: false as const, message: `${label}必须是正整数` };
  }
  return { ok: true as const, value: number };
}
