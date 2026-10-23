import { financeDecimal, financeValue, validateFinanceStorage } from './finance-decimal';
import { z } from '#/adapter/form';

export type OptionalNumberRuleOptions = {
  integer?: boolean;
  max?: number;
  min?: number;
  nonZero?: boolean;
  precision?: number;
  required?: boolean;
};

export function parseOptionalNumber(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d*)?$/.test(text)) return undefined;
  try { return financeValue(text); } catch { return undefined; }

}

export function formatOptionalNumberInput(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    return trimmed;
  }

  return undefined;
}

export function createOptionalNumberRule(
  label: string,
  options: OptionalNumberRuleOptions = {},
) {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .superRefine((value, ctx) => {
      if (
        value === null ||
        value === undefined ||
        value === '' ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        if (options.required) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label}不能为空`,
          });
        }
        return;
      }

      const parsed = parseOptionalNumber(value);
      if (parsed === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}必须是数字`,
        });
        return;
      }

      if (!options.integer) {
        try { validateFinanceStorage(value as FinanceDecimalInput, label); }
        catch (error) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message }); return; }
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/[eE]/.test(trimmed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label}不支持科学计数法`,
          });
          return;
        }
        if (
          options.precision !== undefined &&
          acceptFinanceDecimalInput(trimmed, options.precision) === undefined
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label}最多保留 ${options.precision} 位小数`,
          });
          return;
        }
      }

      if (options.integer && !financeDecimal(parsed).isInteger()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}必须是整数`,
        });
      }

      if (options.nonZero && financeDecimal(parsed).isZero()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}不能为 0`,
        });
      }

      if (options.min !== undefined && financeDecimal(parsed).lt(options.min)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}不能小于 ${options.min}`,
        });
      }

      if (options.max !== undefined && financeDecimal(parsed).gt(options.max)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}不能大于 ${options.max}`,
        });
      }
    });
}

export function createRequiredNumberRule(
  label: string,
  options: Omit<OptionalNumberRuleOptions, 'required'> = {},
) {
  return createOptionalNumberRule(label, { ...options, required: true });
}

export function toOptionalNumberValue(value: unknown): string | undefined {
  return parseOptionalNumber(value);
}

export function normalizeOptionalNumberFields(
  values: Record<string, unknown>,
  fields: string[],
) {
  for (const field of fields) {
    values[field] = toOptionalNumberValue(values[field]);
  }
}

export type FinanceDecimalInput = number | string | null | undefined;

/**
 * 财务金额输入允许短暂出现空值、负号和小数点，但拒绝科学计数法、字母与超精度。
 * 返回 undefined 表示本次输入非法，调用方应保留上一次合法值。
 */
export function acceptFinanceDecimalInput(
  value: FinanceDecimalInput,
  precision?: number,
): string | undefined {
  const text = value === null || value === undefined ? '' : String(value);
  const pattern = precision === undefined ? /^-?\d*(?:\.\d*)?$/ : new RegExp(`^-?\\d*(?:\\.\\d{0,${precision}})?$`);
  return pattern.test(text) ? text : undefined;
}

export function normalizeFinanceDecimalInput(
  value: FinanceDecimalInput,
  precision?: number,
): string | undefined {
  const text =
    value === null || value === undefined ? '' : String(value).trim();
  if (!text || text === '-' || text === '.' || text === '-.') return undefined;
  const accepted = acceptFinanceDecimalInput(text, precision);
  if (accepted === undefined) return undefined;
  return financeValue(accepted);
}
