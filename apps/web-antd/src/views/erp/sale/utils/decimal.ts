export const SALE_DECIMAL_SCALE = 6;

const SCALE_FACTOR = 10n ** BigInt(SALE_DECIMAL_SCALE);
const DECIMAL_PATTERN = /^[-+]?\d+(?:\.\d+)?$/;

export type SaleDecimalParseResult =
  | { ok: true; value: number | undefined }
  | { message: string; ok: false };

export interface SaleDecimalParseOptions {
  allowEmpty?: boolean;
  allowNegative?: boolean;
  integer?: boolean;
  max?: number;
  min?: number;
  nonZero?: boolean;
}

function expandNumber(value: number) {
  if (!Number.isFinite(value)) return '';
  const text = String(value);
  return /e/i.test(text) ? value.toFixed(SALE_DECIMAL_SCALE) : text;
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
  const retained = decimal.slice(0, SALE_DECIMAL_SCALE);
  let scaled =
    BigInt(integer || '0') * SCALE_FACTOR +
    BigInt(retained.padEnd(SALE_DECIMAL_SCALE, '0') || '0');
  const discarded = decimal.slice(SALE_DECIMAL_SCALE);
  if (discarded && Number(discarded[0]) >= 5) scaled += 1n;
  return negative ? -scaled : scaled;
}

function fromScaledInteger(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const integer = absolute / SCALE_FACTOR;
  const decimal = String(absolute % SCALE_FACTOR)
    .padStart(SALE_DECIMAL_SCALE, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${decimal ? `.${decimal}` : ''}`;
}

/** 数量、税率、比例、重量等自然小数展示，最多六位。 */
export function formatSaleDecimal(value: unknown, fallback = ''): string {
  const source = normalizeSource(value);
  if (!source || !DECIMAL_PATTERN.test(source)) return fallback;
  return fromScaledInteger(toScaledInteger(source));
}

/** 金额展示至少两位、最多六位有效小数。 */
export function formatSaleAmount(value: unknown, fallback = ''): string {
  const formatted = formatSaleDecimal(value, '');
  if (!formatted) return fallback;
  const [integer, decimal = ''] = formatted.split('.');
  return `${integer}.${decimal.padEnd(2, '0')}`;
}

/** 主列表与列表汇总固定两位，仅改变显示。 */
export function formatSaleListDecimal(value: unknown, fallback = '-') {
  const source = normalizeSource(value);
  if (!source || !DECIMAL_PATTERN.test(source)) return fallback;
  const scaled = toScaledInteger(source);
  const rounded = roundQuotient(scaled, 10_000n);
  const negative = rounded < 0n;
  const absolute = negative ? -rounded : rounded;
  return `${negative ? '-' : ''}${absolute / 100n}.${String(
    absolute % 100n,
  ).padStart(2, '0')}`;
}

export function parseSaleDecimal(
  value: unknown,
  label: string,
  options: SaleDecimalParseOptions = {},
): SaleDecimalParseResult {
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
  if (options.nonZero && parsed === 0) {
    return { ok: false, message: `${label}不能为 0` };
  }
  if (options.min !== undefined && parsed < options.min) {
    return { ok: false, message: `${label}不能小于 ${options.min}` };
  }
  if (options.max !== undefined && parsed > options.max) {
    return { ok: false, message: `${label}不能大于 ${options.max}` };
  }
  return { ok: true, value: Number(formatSaleDecimal(text, '0')) };
}

export function saleDecimalAdd(...values: unknown[]) {
  return Number(
    fromScaledInteger(
      values.reduce<bigint>((sum, value) => sum + toScaledInteger(value), 0n),
    ),
  );
}

export function saleDecimalSubtract(left: unknown, right: unknown) {
  return saleDecimalAdd(left, -Number(right || 0));
}

export function saleDecimalMultiply(left: unknown, right: unknown) {
  return Number(
    fromScaledInteger(
      roundQuotient(
        toScaledInteger(left) * toScaledInteger(right),
        SCALE_FACTOR,
      ),
    ),
  );
}

export function saleDecimalDivide(left: unknown, right: unknown) {
  const divisor = toScaledInteger(right);
  if (divisor === 0n) return 0;
  return Number(
    fromScaledInteger(
      roundQuotient(toScaledInteger(left) * SCALE_FACTOR, divisor),
    ),
  );
}
