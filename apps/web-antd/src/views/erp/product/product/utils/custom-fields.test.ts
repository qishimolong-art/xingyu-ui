import { describe, expect, it } from 'vitest';

import { buildCustomPriceFieldColumns } from './custom-fields';

describe('buildCustomPriceFieldColumns', () => {
  it('shows every enabled custom price field regardless of list visibility', () => {
    const columns = buildCustomPriceFieldColumns([
      {
        fieldName: 'vipPrice',
        fieldGroup: 'price_info',
        fieldLabel: '会员价',
        fieldSource: 'CUSTOM',
        listVisible: false,
        moduleKey: 'erp_product',
        required: false,
        visible: true,
      },
      {
        fieldName: 'baseRemark',
        fieldGroup: 'base_info',
        fieldLabel: '基础备注',
        fieldSource: 'CUSTOM',
        listVisible: true,
        moduleKey: 'erp_product',
        required: false,
        visible: true,
      },
    ]);

    expect(columns).toHaveLength(1);
    expect(columns[0]?.field).toBe('customFields__vipPrice');
    expect(columns[0]?.title).toBe('会员价');
  });

  it('excludes disabled and permission-hidden custom price fields', () => {
    const columns = buildCustomPriceFieldColumns(
      [
        {
          fieldName: 'hiddenPrice',
          fieldGroup: 'price_info',
          fieldSource: 'CUSTOM',
          moduleKey: 'erp_product',
          required: false,
          visible: true,
        },
        {
          fieldName: 'disabledPrice',
          fieldGroup: 'price_info',
          fieldSource: 'CUSTOM',
          moduleKey: 'erp_product',
          required: false,
          visible: false,
        },
      ],
      ['hiddenPrice'],
    );

    expect(columns).toEqual([]);
  });

  it('formats values from the row customFields map', () => {
    const [column] = buildCustomPriceFieldColumns([
      {
        fieldName: 'vipPrice',
        fieldGroup: 'price_info',
        fieldSource: 'CUSTOM',
        fieldType: 'DECIMAL',
        moduleKey: 'erp_product',
        required: false,
        visible: true,
      },
    ]);

    const formatter = column?.formatter as (params: {
      row: { customFields?: Record<string, any> };
    }) => unknown;
    expect(formatter({ row: { customFields: { vipPrice: 88.5 } } })).toBe(88.5);
    expect(formatter({ row: {} })).toBe('');
  });
});
