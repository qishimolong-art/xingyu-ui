import { z } from '#/adapter/form';

export type OptionalNumberRuleOptions = {
  decimalPlaces?: number;
  integer?: boolean;
  max?: number;
  min?: number;
};

export function parseOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getDecimalPlaces(value: unknown) {
  const text = String(value).trim();
  const decimal = text.split('.')[1];
  return decimal ? decimal.length : 0;
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

      if (options.integer && !Number.isInteger(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}必须是整数`,
        });
      }

      if (
        options.decimalPlaces !== undefined &&
        getDecimalPlaces(value) > options.decimalPlaces
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}最多 ${options.decimalPlaces} 位小数`,
        });
      }

      if (options.min !== undefined && parsed < options.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}不能小于 ${options.min}`,
        });
      }

      if (options.max !== undefined && parsed > options.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}不能大于 ${options.max}`,
        });
      }
    });
}

export function normalizeOptionalNumberFields(
  values: Record<string, unknown>,
  fields: string[],
) {
  fields.forEach((field) => {
    values[field] = parseOptionalNumber(values[field]);
  });
  return values;
}
