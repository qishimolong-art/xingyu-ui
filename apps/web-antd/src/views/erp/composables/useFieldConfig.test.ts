import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRuntimeFieldConfigList } from '#/api/erp/config/field';

import {
  applyEffectiveFieldVisibility,
  clearFieldConfigCache,
  getFieldConfigFieldKeys,
  getFieldConfigHiddenFields,
  isFieldConfigKnown,
  isEffectiveFieldHidden,
} from './useFieldConfig';

vi.mock('#/api/erp/config/field', () => ({
  getRuntimeFieldConfigList: vi.fn(),
}));

const mockedGetRuntimeFieldConfigList = vi.mocked(getRuntimeFieldConfigList);

function fieldConfig(
  fieldName: string,
  visible: boolean,
  overrides: Record<string, unknown> = {},
) {
  return {
    fieldName,
    fieldLabel: '',
    moduleKey: 'supplier',
    required: false,
    visible,
    ...overrides,
  };
}

describe('effective field visibility', () => {
  beforeEach(() => {
    clearFieldConfigCache();
    mockedGetRuntimeFieldConfigList.mockReset();
  });

  it('hides a field when either field config or role permission hides it', async () => {
    mockedGetRuntimeFieldConfigList.mockResolvedValue([
      fieldConfig('contact', false),
      fieldConfig('mobile', true),
      fieldConfig('email', true),
    ] as any);

    const schema = [
      { fieldName: 'contact', label: '联系人' },
      { fieldName: 'mobile', label: '手机号码' },
      { fieldName: 'email', label: '邮箱' },
    ] as any;

    await expect(
      applyEffectiveFieldVisibility(schema, {
        moduleKey: 'supplier',
        roleHiddenFields: ['mobile'],
      }),
    ).resolves.toEqual([{ fieldName: 'email', label: '邮箱' }]);
  });

  it('keeps a field visible only when both field config and role permission allow it', () => {
    expect(
      isEffectiveFieldHidden('email', {
        fieldConfigHiddenFields: ['contact'],
        roleHiddenFields: ['mobile'],
      }),
    ).toBe(false);
    expect(
      isEffectiveFieldHidden('contact', {
        fieldConfigHiddenFields: ['contact'],
        roleHiddenFields: [],
      }),
    ).toBe(true);
    expect(
      isEffectiveFieldHidden('mobile', {
        fieldConfigHiddenFields: [],
        roleHiddenFields: ['mobile'],
      }),
    ).toBe(true);
  });

  it('applies supplier region and areaIds aliases to field config hidden fields', async () => {
    mockedGetRuntimeFieldConfigList.mockResolvedValue([
      fieldConfig('region', false),
    ] as any);

    const hiddenFields = await getFieldConfigHiddenFields('supplier', {
      fieldAliases: { areaIds: ['region'] },
    });

    expect(hiddenFields).toEqual(expect.arrayContaining(['areaIds', 'region']));
    expect(
      isEffectiveFieldHidden('areaIds', {
        fieldAliases: { areaIds: ['region'] },
        fieldConfigHiddenFields: hiddenFields,
        roleHiddenFields: [],
      }),
    ).toBe(true);
  });

  it('returns configured field keys and applies aliases to known field checks', async () => {
    mockedGetRuntimeFieldConfigList.mockResolvedValue([
      fieldConfig('region', true),
      fieldConfig('contact', true),
    ] as any);

    const fieldKeys = await getFieldConfigFieldKeys('supplier', {
      fieldAliases: { areaIds: ['region'] },
    });

    expect(fieldKeys).toEqual(
      expect.arrayContaining(['areaIds', 'region', 'contact']),
    );
    expect(
      isFieldConfigKnown('areaIds', {
        fieldAliases: { areaIds: ['region'] },
        fieldConfigFieldKeys: fieldKeys,
      }),
    ).toBe(true);
    expect(
      isFieldConfigKnown('missingField', {
        fieldConfigFieldKeys: fieldKeys,
      }),
    ).toBe(false);
  });
});
