export const PURCHASE_DECIMAL_SCALE = 6;

const SCALE_FACTOR = 10n ** BigInt(PURCHASE_DECIMAL_SCALE);
const DECIMAL_PATTERN = /^[-+]?\d+(?:\.\d+)?$/;

export type PurchaseDecimalParseResult =
  | { ok: true; value: number | undefined }
  | { message: string; ok: false };

export interface PurchaseDecimalParseOptions {
  allowEmpty?: boolean;
  allowNegative?: boolean;
  integer?: boolean;
  max?: number;
  min?: number;
}

function expandNumber(value: number) {
  if (!Number.isFinite(value)) return '';
  const text = String(value);
  return /e/i.test(text) ? value.toFixed(PURCHASE_DECIMAL_SCALE) : text;
}

function normalizeSource(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return typeof value === 'number' ? expandNumber(value) : String(value).trim();
}

function roundQuotient(dividend: bigint, divisor: bigint) {
  if (divisor === 0n) return 0n;
  const negative = dividend < 0n !== divisor < 0n;
  const absoluteDividend = dividend < 0n ? -dividend : dividend;
  const absoluteDivisor = divisor < 0n ? -divisor : divisor;
  let quotient = absoluteDividend / absoluteDivisor;
  const remainder = absoluteDividend % absoluteDivisor;
  if (remainder * 2n >= absoluteDivisor) quotient += 1n;
  return negative ? -quotient : quotient;
}

function toScaledInteger(value: unknown) {
  const source = normalizeSource(value);
  if (!source || !DECIMAL_PATTERN.test(source)) return 0n;
  const negative = source.startsWith('-');
  const unsigned = source.replace(/^[-+]/, '');
  const [integer = '0', decimal = ''] = unsigned.split('.');
  const retained = decimal.slice(0, PURCHASE_DECIMAL_SCALE);
  let scaled =
    BigInt(integer || '0') * SCALE_FACTOR +
    BigInt(retained.padEnd(PURCHASE_DECIMAL_SCALE, '0') || '0');
  const discarded = decimal.slice(PURCHASE_DECIMAL_SCALE);
  if (discarded && Number(discarded[0]) >= 5) scaled += 1n;
  return negative ? -scaled : scaled;
}

function fromScaledInteger(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const integer = absolute / SCALE_FACTOR;
  const decimal = String(absolute % SCALE_FACTOR)
    .padStart(PURCHASE_DECIMAL_SCALE, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${decimal ? `.${decimal}` : ''}`;
}

export function formatPurchaseDecimal(value: unknown, fallback = ''): string {
  const source = normalizeSource(value);
  if (!source || !DECIMAL_PATTERN.test(source)) return fallback;
  return fromScaledInteger(toScaledInteger(source));
}

/**
 * 采购金额展示：至少保留两位小数，最多展示六位有效小数。
 *
 * 该方法只负责展示，不改变保存值。无意义的第三位及以后尾零会被移除，
 * 例如 1 -> 1.00、0.1 -> 0.10、1.230000 -> 1.23。
 */
export function formatPurchaseAmount(value: unknown, fallback = ''): string {
  const formatted = formatPurchaseDecimal(value, '');
  if (!formatted) return fallback;
  const [integer, decimal = ''] = formatted.split('.');
  return `${integer}.${decimal.padEnd(2, '0')}`;
}

export function formatPurchaseListDecimal(value: unknown, fallback = '-') {
  const source = normalizeSource(value);
  if (!source || !DECIMAL_PATTERN.test(source)) return fallback;
  const scaled = toScaledInteger(source);
  const rounded = roundQuotient(scaled, 10_000n);
  const negative = rounded < 0n;
  const absolute = negative ? -rounded : rounded;
  return `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function parsePurchaseDecimal(
  value: unknown,
  label: string,
  options: PurchaseDecimalParseOptions = {},
): PurchaseDecimalParseResult {
  const text = normalizeSource(value);
  if (!text) {
    return options.allowEmpty
      ? { ok: true, value: undefined }
      : { ok: false, message: `请输入${label}` };
  }
  const decimalPattern = options.integer
    ? /^[-+]?\d+$/
    : /^[-+]?\d+(?:\.\d{0,6})?$/;
  if (!decimalPattern.test(text) || /e/i.test(text)) {
    return {
      ok: false,
      message: options.integer
        ? `${label}必须为整数`
        : `${label}必须为数字，最多 6 位小数`,
    };
  }
  if (!options.allowNegative && text.startsWith('-')) {
    return { ok: false, message: `${label}不能为负数` };
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: `${label}必须为数字` };
  }
  if (options.min !== undefined && parsed < options.min) {
    return { ok: false, message: `${label}不能小于 ${options.min}` };
  }
  if (options.max !== undefined && parsed > options.max) {
    return { ok: false, message: `${label}不能大于 ${options.max}` };
  }
  return { ok: true, value: Number(formatPurchaseDecimal(text, '0')) };
}

export function purchaseDecimalAdd(...values: unknown[]) {
  return Number(
    fromScaledInteger(
      values.reduce<bigint>((sum, value) => sum + toScaledInteger(value), 0n),
    ),
  );
}

export function purchaseDecimalSubtract(left: unknown, right: unknown) {
  return purchaseDecimalAdd(left, -Number(right || 0));
}

export function purchaseDecimalMultiply(left: unknown, right: unknown) {
  const result = roundQuotient(
    toScaledInteger(left) * toScaledInteger(right),
    SCALE_FACTOR,
  );
  return Number(fromScaledInteger(result));
}

export function purchaseDecimalDivide(left: unknown, right: unknown) {
  const divisor = toScaledInteger(right);
  if (divisor === 0n) return 0;
  const result = roundQuotient(toScaledInteger(left) * SCALE_FACTOR, divisor);
  return Number(fromScaledInteger(result));
}
