import type { VbenFormSchema } from '#/adapter/form';

import { describe, expect, it } from 'vitest';

import { replaceDetailFieldWithLinkSlot } from './detail-link-schema';

const schema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'no', label: '单号' },
  {
    component: 'ApiSelect',
    fieldName: 'customerId',
    label: '客户',
    rules: 'required',
  },
];

describe('detail link schema', () => {
  it('keeps the original field and selector outside detail mode', () => {
    expect(
      replaceDetailFieldWithLinkSlot(
        schema,
        'edit',
        'customerId',
        'customerDetail',
      ),
    ).toBe(schema);
  });

  it('uses a fixed detail slot field without detail validation rules', () => {
    const result = replaceDetailFieldWithLinkSlot(
      schema,
      'detail',
      'customerId',
      'customerDetail',
    );

    expect(result[1]).toMatchObject({
      component: 'Input',
      fieldName: 'customerDetail',
      label: '客户',
    });
    expect(result[1]).not.toHaveProperty('rules');
    expect(schema[1]).toMatchObject({
      component: 'ApiSelect',
      fieldName: 'customerId',
      rules: 'required',
    });
  });
});
