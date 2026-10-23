import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import type { ErpFieldConfigApi } from '#/api/erp/config/field';

import { getRuntimeFieldConfigList } from '#/api/erp/config/field';

export const PRODUCT_FIELD_CONFIG_MODULE = 'erp_product';

export type ProductCustomFieldGroup =
  | 'base_info'
  | 'extend_info'
  | 'price_info';

const CUSTOM_FIELD_PREFIX = 'customFields__';

function isCustomField(config: ErpFieldConfigApi.FieldConfig) {
  return String(config.fieldSource ?? '').toUpperCase() === 'CUSTOM';
}

function sortCustomFields(
  fields: ErpFieldConfigApi.FieldConfig[],
): ErpFieldConfigApi.FieldConfig[] {
  return fields.toSorted((a, b) => {
    const sortA = a.sort ?? Number.MAX_SAFE_INTEGER;
    const sortB = b.sort ?? Number.MAX_SAFE_INTEGER;
    if (sortA !== sortB) return sortA - sortB;
    return String(a.fieldName).localeCompare(String(b.fieldName));
  });
}

export async function getProductCustomFieldConfigs() {
  const config = await getRuntimeFieldConfigList(PRODUCT_FIELD_CONFIG_MODULE);
  return sortCustomFields(config.filter(isCustomField));
}

function toCustomFieldName(fieldName: string) {
  return `${CUSTOM_FIELD_PREFIX}${fieldName}`;
}

function toComponent(
  config: ErpFieldConfigApi.FieldConfig,
): VbenFormSchema['component'] {
  switch (String(config.fieldType ?? 'TEXT').toUpperCase()) {
    case 'BOOLEAN': {
      return 'Switch';
    }
    case 'DATE':
    case 'DATETIME': {
      return 'DatePicker';
    }
    case 'DECIMAL':
    case 'INTEGER': {
      return 'InputNumber';
    }
    case 'TEXTAREA': {
      return 'Textarea';
    }
    default: {
      return 'Input';
    }
  }
}

function toComponentProps(config: ErpFieldConfigApi.FieldConfig) {
  const readonly = Boolean(config.readonly);
  const disabled = readonly;
  switch (String(config.fieldType ?? 'TEXT').toUpperCase()) {
    case 'BOOLEAN': {
      return { disabled };
    }
    case 'DATE': {
      return {
        disabled,
        format: 'YYYY-MM-DD',
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD',
      };
    }
    case 'DATETIME': {
      return {
        disabled,
        format: 'YYYY-MM-DD HH:mm:ss',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      };
    }
    case 'DECIMAL': {
      return {
        disabled,
        precision: config.decimalScale ?? 2,
        style: { width: '100%' },
      };
    }
    case 'INTEGER': {
      return {
        disabled,
        precision: 0,
        style: { width: '100%' },
      };
    }
    case 'TEXTAREA': {
      return {
        allowClear: !readonly,
        disabled,
        placeholder: `请输入${config.fieldLabel ?? config.fieldName}`,
        rows: 3,
      };
    }
    default: {
      return {
        allowClear: !readonly,
        disabled,
        maxlength: config.maxLength,
        placeholder: `请输入${config.fieldLabel ?? config.fieldName}`,
      };
    }
  }
}

export function buildCustomFieldSchemas(
  configs: ErpFieldConfigApi.FieldConfig[],
  group: ProductCustomFieldGroup,
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return sortCustomFields(configs)
    .filter((config) => config.visible !== false)
    .filter(
      (config) =>
        !hiddenFields.includes(config.fieldName) &&
        !hiddenFields.includes(`col_${config.fieldName}`),
    )
    .filter((config) => (config.fieldGroup || 'base_info') === group)
    .map((config) => ({
      component: toComponent(config),
      componentProps: toComponentProps(config),
      fieldName: toCustomFieldName(config.fieldName),
      formItemClass: config.fieldType === 'TEXTAREA' ? 'col-span-2' : undefined,
      label: config.fieldLabel || config.fieldName,
      rules: config.required ? 'required' : undefined,
    }));
}

function formatCustomFieldValue(
  value: any,
  config: ErpFieldConfigApi.FieldConfig,
) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (String(config.fieldType ?? '').toUpperCase() === 'BOOLEAN') {
    return value ? '是' : '否';
  }
  return value;
}

export function buildCustomFieldColumns(
  configs: ErpFieldConfigApi.FieldConfig[],
  hiddenFields: string[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return sortCustomFields(configs)
    .filter((config) => config.visible !== false && config.listVisible === true)
    .filter(
      (config) =>
        !hiddenFields.includes(config.fieldName) &&
        !hiddenFields.includes(`col_${config.fieldName}`),
    )
    .map((config) => ({
      field: toCustomFieldName(config.fieldName),
      minWidth: 120,
      title: config.fieldLabel || config.fieldName,
      formatter: ({ row }: { row: { customFields?: Record<string, any> } }) =>
        formatCustomFieldValue(row.customFields?.[config.fieldName], config),
    }));
}

/**
 * 业务库存选择需要展示全部启用的自定义价格字段，不受配件列表的
 * listVisible 开关限制；字段权限仍由 hiddenFields 和库存接口共同约束。
 */
export function buildCustomPriceFieldColumns(
  configs: ErpFieldConfigApi.FieldConfig[],
  hiddenFields: string[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return sortCustomFields(configs)
    .filter((config) => config.visible !== false)
    .filter((config) => (config.fieldGroup || 'base_info') === 'price_info')
    .filter(
      (config) =>
        !hiddenFields.includes(config.fieldName) &&
        !hiddenFields.includes(`col_${config.fieldName}`),
    )
    .map((config) => ({
      field: toCustomFieldName(config.fieldName),
      minWidth: 120,
      title: config.fieldLabel || config.fieldName,
      formatter: ({ row }: { row: { customFields?: Record<string, any> } }) =>
        formatCustomFieldValue(row.customFields?.[config.fieldName], config),
    }));
}

export function flattenCustomFields<
  T extends { customFields?: Record<string, any> },
>(data: T): T & Record<string, any> {
  const customFields = data.customFields ?? {};
  const result: Record<string, any> = { ...data };
  Object.entries(customFields).forEach(([key, value]) => {
    result[toCustomFieldName(key)] = value;
  });
  return result as T & Record<string, any>;
}

export function mergeCustomFields<T extends Record<string, any>>(values: T) {
  const result: Record<string, any> = {};
  const customFields: Record<string, any> = { ...values.customFields };

  Object.entries(values).forEach(([key, value]) => {
    if (key.startsWith(CUSTOM_FIELD_PREFIX)) {
      customFields[key.slice(CUSTOM_FIELD_PREFIX.length)] = value;
    } else {
      result[key] = value;
    }
  });

  result.customFields = customFields;
  return result as T & { customFields: Record<string, any> };
}
