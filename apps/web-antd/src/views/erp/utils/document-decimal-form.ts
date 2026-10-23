import type { VbenFormSchema } from '#/adapter/form';

import { z } from '#/adapter/form';

type DecimalParser = (
  value: unknown,
  label: string,
  options: { allowEmpty: boolean; allowNegative: boolean; integer: boolean },
) => { ok: true; value: number | undefined } | { ok: false; message: string };

const DECIMAL_FIELDS = /(?:price|amount|freight|cost|fee|discount|deposit|refund|weight|count|percent|ratio|rate|floatRecord)$/i;
const INTEGER_FIELDS = /^(?:packageCount|packageQty|wholeQty|pieceCount|invoiceCount)$/;
const MONEY_FIELDS = /(?:price|amount|freight|cost|fee|deposit|refund)$/i;

/** 只由采购／销售单据显式启用，保留现有字段校验与 Enter 流转。 */
export function withDocumentDecimalSchemas<T extends VbenFormSchema>(
  schemas: T[],
  parse: DecimalParser,
  amount: (value: unknown, fallback?: string) => string,
  natural: (value: unknown, fallback?: string) => string,
): T[] {
  return schemas.map((schema) => {
    const field = schema.fieldName;
    if (!field || !DECIMAL_FIELDS.test(field) || !['Input', 'InputNumber'].includes(String(schema.component))) return schema;
    const integer = INTEGER_FIELDS.test(field);
    const label = typeof schema.label === 'string' ? schema.label : field;
    const parseValue = (value: unknown) => parse(value, label, { allowEmpty: true, allowNegative: true, integer });
    const format = !integer && MONEY_FIELDS.test(field) ? amount : natural;
    const precisionRule = z.any().superRefine((value, ctx) => {
      const result = parseValue(value);
      if (!result.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    });
    const rules = schema.rules && typeof schema.rules === 'object' && 'and' in schema.rules
      ? schema.rules.and(precisionRule)
      : schema.rules || precisionRule;
    const originalProps = schema.componentProps;
    let editing = false;
    return {
      ...schema,
      component: 'Input',
      rules,
      componentProps: (values, actions) => {
        const props = typeof originalProps === 'function' ? originalProps(values, actions) : originalProps || {};
        const current = values[field];
        const result = parseValue(current);
        return {
          ...props,
          inputmode: integer ? 'numeric' : 'decimal',
          value: !editing && result.ok && result.value !== undefined ? format(result.value) : current,
          onFocus: (event: FocusEvent) => { editing = true; props.onFocus?.(event); },
          onBlur: (event: FocusEvent) => {
            editing = false;
            props.onBlur?.(event);
            if (props.disabled || props.readonly) return;
            const value = (event.target as HTMLInputElement | null)?.value;
            const parsed = parseValue(value);
            if (!parsed.ok) { actions.setFieldError(field, parsed.message); return; }
            actions.setFieldValue(field, parsed.value === undefined ? undefined : format(parsed.value));
          },
        };
      },
    } as T;
  });
}
