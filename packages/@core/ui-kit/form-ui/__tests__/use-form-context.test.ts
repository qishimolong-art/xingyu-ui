import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { VbenFormProps } from '../src/types';

import { generateInitialValues } from '../src/use-form-context';

function getInitialValues(schema: VbenFormProps['schema']) {
  return generateInitialValues(schema);
}

describe('useFormInitial', () => {
  it('keeps required number fields empty when no default is configured', () => {
    const values = getInitialValues([
      {
        component: 'Select',
        fieldName: 'relationType',
        rules: z.number({ message: '请选择往来类别' }),
      },
    ]);

    expect(values).toEqual({ relationType: null });
  });

  it('keeps optional number fields empty when no default is configured', () => {
    const values = getInitialValues([
      {
        component: 'Select',
        fieldName: 'customerType',
        rules: z.number().optional(),
      },
    ]);

    expect(values).toEqual({ customerType: null });
  });

  it('accepts generated null values for nullable optional number fields', () => {
    const rules = z.number().nullable().optional();
    const values = getInitialValues([
      {
        component: 'Select',
        fieldName: 'leaderUserId',
        rules,
      },
    ]);

    expect(values).toEqual({ leaderUserId: null });
    expect(rules.safeParse(values.leaderUserId).success).toBe(true);
  });

  it('preserves zod number defaults', () => {
    const values = getInitialValues([
      {
        component: 'Select',
        fieldName: 'priceLevel',
        rules: z.number().default(3),
      },
    ]);

    expect(values).toEqual({ priceLevel: 3 });
  });

  it('preserves explicit schema defaults', () => {
    const values = getInitialValues([
      {
        component: 'Select',
        defaultValue: null,
        fieldName: 'settleMethod',
        rules: z.number({ message: '请选择结算方式' }),
      },
    ]);

    expect(values).toEqual({ settleMethod: null });
  });
});
