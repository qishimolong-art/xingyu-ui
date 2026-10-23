import type { VbenFormSchema } from '#/adapter/form';

import { getSupplier } from '#/api/erp/purchase/supplier';
import { getCustomer } from '#/api/erp/sale/customer';
import { getWarehouse } from '#/api/erp/stock/warehouse';
import { getDept } from '#/api/system/dept';
import { getSimpleUserList, getUser } from '#/api/system/user';

const SELECT_POPUP_CLASS = 'stock-document-form-select-dropdown';
const POPUP_COMPONENTS = new Set([
  'ApiSelect',
  'CustomerLazySelect',
  'ErpLazyPageSelect',
  'Select',
  'SupplierLazySelect',
  'TreeSelect',
]);
const DETAIL_TEXT_FIELD_COMPONENTS = new Set([
  'ApiSelect',
  'CustomerLazySelect',
  'ErpLazyPageSelect',
  'Select',
  'SupplierLazySelect',
]);

type StockDocumentFormSchema = {
  component?: unknown;
  componentProps?: unknown;
  fieldName?: string;
  rules?: unknown;
};

type StockDocumentHydrationData = {
  creator?: number | string;
  creatorName?: string;
  customerId?: number | string;
  customerName?: string;
  deptId?: number | string;
  deptName?: string;
  fromDeptId?: number | string;
  fromDeptName?: string;
  fromWarehouseId?: number | string;
  fromWarehouseName?: string;
  handlerId?: number | string;
  handlerName?: string;
  supplierId?: number | string;
  supplierName?: string;
  toDeptId?: number | string;
  toDeptName?: string;
  toWarehouseId?: number | string;
  toWarehouseName?: string;
  warehouseId?: number | string;
  warehouseName?: string;
};

type StockDocumentPrepareOptions = {
  data?: StockDocumentHydrationData;
  formType?: string;
};

type DisplayFieldConfig = {
  fieldName: keyof StockDocumentHydrationData;
  labelField: keyof StockDocumentHydrationData;
  type: 'customer' | 'dept' | 'supplier' | 'user' | 'warehouse';
};

const DISPLAY_FIELD_CONFIGS: DisplayFieldConfig[] = [
  { fieldName: 'creator', labelField: 'creatorName', type: 'user' },
  { fieldName: 'customerId', labelField: 'customerName', type: 'customer' },
  { fieldName: 'deptId', labelField: 'deptName', type: 'dept' },
  { fieldName: 'fromDeptId', labelField: 'fromDeptName', type: 'dept' },
  {
    fieldName: 'fromWarehouseId',
    labelField: 'fromWarehouseName',
    type: 'warehouse',
  },
  { fieldName: 'handlerId', labelField: 'handlerName', type: 'user' },
  { fieldName: 'supplierId', labelField: 'supplierName', type: 'supplier' },
  { fieldName: 'toDeptId', labelField: 'toDeptName', type: 'dept' },
  {
    fieldName: 'toWarehouseId',
    labelField: 'toWarehouseName',
    type: 'warehouse',
  },
  { fieldName: 'warehouseId', labelField: 'warehouseName', type: 'warehouse' },
];

export const CURRENT_SELECT_LABEL_PLACEHOLDER = '加载中...';

function appendPopupClassName(componentProps: Record<string, any> = {}) {
  const popupClassName = [componentProps.popupClassName, SELECT_POPUP_CLASS]
    .filter(Boolean)
    .join(' ');
  return {
    ...componentProps,
    popupClassName,
  };
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

export function isMissingStockDocumentDisplayName(
  value: unknown,
  id?: unknown,
) {
  return (
    !hasValue(value) ||
    value === CURRENT_SELECT_LABEL_PLACEHOLDER ||
    (hasValue(id) && `${value}` === `${id}`)
  );
}

function getOptionValue(option: Record<string, any>) {
  return option.value ?? option.id;
}

function getOptionLabel(option: Record<string, any>) {
  return option.label ?? option.name ?? option.nickname;
}

export function mergeStockDocumentOption(
  data: unknown,
  option: Record<string, any>,
) {
  if (data === undefined || data === null) {
    return [option];
  }
  if (!Array.isArray(data)) {
    return data;
  }
  const optionValue = getOptionValue(option);
  const index = data.findIndex((item) => {
    const itemValue = item?.value ?? item?.id;
    return `${itemValue}` === `${optionValue}`;
  });
  if (index < 0) {
    return [option, ...data];
  }

  const oldOption = data[index] as Record<string, any>;
  const nextOption = { ...oldOption, ...option };
  if (
    `${getOptionValue(oldOption) ?? ''}` ===
      `${getOptionValue(nextOption) ?? ''}` &&
    `${getOptionLabel(oldOption) ?? ''}` ===
      `${getOptionLabel(nextOption) ?? ''}` &&
    `${oldOption.name ?? ''}` === `${nextOption.name ?? ''}` &&
    `${oldOption.nickname ?? ''}` === `${nextOption.nickname ?? ''}`
  ) {
    return data;
  }

  const nextData = [...data];
  nextData[index] = nextOption;
  return nextData;
}

export function isResolvedStockDocumentOption(option: Record<string, any>) {
  const value = getOptionValue(option);
  const label = getOptionLabel(option);
  return (
    hasValue(value) &&
    hasValue(label) &&
    !isMissingStockDocumentDisplayName(label, value)
  );
}

export function mergeResolvedStockDocumentOptions(
  oldOptions: Record<string, any>[] = [],
  nextOptions: Record<string, any>[] = [],
) {
  let changed = oldOptions.some((item) => !isResolvedStockDocumentOption(item));
  const optionMap = new Map<string, Record<string, any>>();
  oldOptions.filter(isResolvedStockDocumentOption).forEach((item) => {
    optionMap.set(String(getOptionValue(item)), item);
  });
  nextOptions.filter(isResolvedStockDocumentOption).forEach((item) => {
    const key = String(getOptionValue(item));
    const existed = optionMap.get(key);
    if (!existed) {
      optionMap.set(key, item);
      changed = true;
      return;
    }
    const merged = { ...existed, ...item };
    if (
      `${getOptionLabel(existed) ?? ''}` !==
        `${getOptionLabel(merged) ?? ''}` ||
      `${existed.name ?? ''}` !== `${merged.name ?? ''}` ||
      `${existed.deptId ?? ''}` !== `${merged.deptId ?? ''}` ||
      `${existed.deptName ?? ''}` !== `${merged.deptName ?? ''}`
    ) {
      optionMap.set(key, merged);
      changed = true;
    }
  });
  return changed ? [...optionMap.values()] : oldOptions;
}

function withCurrentFieldOption(
  componentProps: unknown,
  option: Record<string, any>,
) {
  const enhanceProps = (resolved: Record<string, unknown>) => {
    const originalAfterFetch = resolved.afterFetch;
    return {
      ...resolved,
      options: mergeStockDocumentOption(resolved.options, option),
      afterFetch: async (data: unknown) => {
        const fetched =
          typeof originalAfterFetch === 'function'
            ? await originalAfterFetch(data)
            : data;
        return mergeStockDocumentOption(fetched, option);
      },
    };
  };

  if (typeof componentProps === 'function') {
    return (...args: unknown[]) => {
      const resolved = componentProps(...args) as Record<string, unknown>;
      return enhanceProps(
        resolved && typeof resolved === 'object' ? resolved : {},
      );
    };
  }

  return enhanceProps(
    componentProps && typeof componentProps === 'object'
      ? (componentProps as Record<string, unknown>)
      : {},
  );
}

function getCurrentFieldOption(
  fieldName: string | undefined,
  data?: StockDocumentHydrationData,
) {
  if (!data || !fieldName) {
    return;
  }
  const config = DISPLAY_FIELD_CONFIGS.find(
    (item) => item.fieldName === fieldName,
  );
  if (!config) {
    return;
  }
  const value = data[config.fieldName];
  const label = data[config.labelField];
  if (
    !hasValue(value) ||
    !label ||
    isMissingStockDocumentDisplayName(label, value)
  ) {
    return;
  }
  return {
    id: value,
    label,
    name: label,
    ...(config.type === 'user' ? { nickname: label } : {}),
    value,
  };
}

function withPopupClass(componentProps: unknown) {
  if (typeof componentProps === 'function') {
    return (...args: unknown[]) => {
      const resolved = componentProps(...args) as Record<string, unknown>;
      return appendPopupClassName(
        resolved && typeof resolved === 'object' ? resolved : {},
      );
    };
  }
  return appendPopupClassName(
    componentProps && typeof componentProps === 'object'
      ? (componentProps as Record<string, unknown>)
      : {},
  );
}

function shouldUseDetailTextField(
  field: StockDocumentFormSchema,
  formType?: string,
) {
  return (
    formType === 'detail' &&
    DETAIL_TEXT_FIELD_COMPONENTS.has(String(field.component ?? '')) &&
    DISPLAY_FIELD_CONFIGS.some((config) => config.fieldName === field.fieldName)
  );
}

function toDetailTextField<T extends StockDocumentFormSchema>(field: T): T {
  return {
    ...field,
    component: 'Input',
    componentProps: {
      class: 'w-full stock-document-form-readonly-text',
      disabled: true,
      placeholder: '-',
    },
    rules: undefined,
  } as T;
}

function getDisplayFieldText(
  data: StockDocumentHydrationData,
  config: DisplayFieldConfig,
) {
  const value = data[config.fieldName];
  const label = data[config.labelField];
  if (!hasValue(value)) {
    return '';
  }
  return isMissingStockDocumentDisplayName(label, value) ? '' : `${label}`;
}

/**
 * 收敛库存单据主表单 schema：明细由独立分区渲染，并为下拉浮层附加显式字号类。
 */
export function buildStockDocumentFormSchema(
  schema: VbenFormSchema[],
  options: StockDocumentPrepareOptions = {},
): VbenFormSchema[] {
  return schema
    .filter((item) => item.fieldName !== 'items')
    .map((item) => {
      if (shouldUseDetailTextField(item, options.formType)) {
        return toDetailTextField(item);
      }
      if (!POPUP_COMPONENTS.has(String(item.component))) {
        return item;
      }
      const currentOption = getCurrentFieldOption(item.fieldName, options.data);
      let componentProps: unknown = withPopupClass(item.componentProps);
      if (currentOption) {
        componentProps = withCurrentFieldOption(componentProps, currentOption);
      }
      return {
        ...item,
        componentProps,
      } as VbenFormSchema;
    });
}

export function withCurrentStockDocumentSelectOptions<
  T extends StockDocumentFormSchema,
>(schema: T[], data?: StockDocumentHydrationData) {
  return schema.map((field) => {
    const option = getCurrentFieldOption(field.fieldName, data);
    if (!option) {
      return field;
    }
    return {
      ...field,
      componentProps: withCurrentFieldOption(field.componentProps, option),
    };
  }) as T[];
}

export function buildStockDocumentDetailFormValues<T extends object>(
  data: T,
  formType?: string,
): T {
  if (formType !== 'detail') {
    return data;
  }
  const nextData = { ...(data as Record<string, unknown>) };
  DISPLAY_FIELD_CONFIGS.forEach((config) => {
    const fieldName = String(config.fieldName);
    if (!hasValue(nextData[fieldName])) {
      return;
    }
    nextData[fieldName] = getDisplayFieldText(nextData, config) || '-';
  });
  return nextData as T;
}

function getUserDisplayName(user: { nickname?: string; username?: string }) {
  return user.nickname || user.username;
}

async function hydrateUserLabels(
  ids: Set<number>,
  target: Record<string, unknown>,
) {
  if (ids.size === 0) {
    return;
  }
  const userNameMap = new Map<number, string>();
  const users = await getSimpleUserList().catch(() => []);
  users.forEach((user) => {
    if (!hasValue(user.id)) {
      return;
    }
    const name = getUserDisplayName(user);
    if (name) {
      userNameMap.set(Number(user.id), name);
    }
  });
  const missingIds = [...ids].filter((id) => !userNameMap.has(id));
  const fallbackUsers = await Promise.all(
    missingIds.map((id) => getUser(id).catch(() => undefined)),
  );
  fallbackUsers.forEach((user) => {
    if (!user || !hasValue(user.id)) {
      return;
    }
    const name = getUserDisplayName(user);
    if (name) {
      userNameMap.set(Number(user.id), name);
    }
  });
  DISPLAY_FIELD_CONFIGS.filter((config) => config.type === 'user').forEach(
    (config) => {
      const value = target[config.fieldName];
      const label = target[config.labelField];
      if (
        !hasValue(value) ||
        !isMissingStockDocumentDisplayName(label, value)
      ) {
        return;
      }
      const name = userNameMap.get(Number(value));
      if (name) {
        target[config.labelField] = name;
      }
    },
  );
}

async function hydrateEntityLabel(
  id: number,
  type: DisplayFieldConfig['type'],
) {
  if (type === 'dept') {
    return (await getDept(id).catch(() => undefined))?.name;
  }
  if (type === 'warehouse') {
    return (await getWarehouse(id).catch(() => undefined))?.name;
  }
  if (type === 'supplier') {
    return (await getSupplier(id).catch(() => undefined))?.name;
  }
  if (type === 'customer') {
    return (await getCustomer(id).catch(() => undefined))?.name;
  }
  return undefined;
}

export async function hydrateStockDocumentFormSelectLabels<
  T extends StockDocumentHydrationData,
>(data: T): Promise<T> {
  const nextData = { ...data } as T & Record<string, unknown>;
  const missingUserIds = new Set<number>();
  const missingEntityConfigs: Array<{
    config: DisplayFieldConfig;
    id: number;
  }> = [];

  DISPLAY_FIELD_CONFIGS.forEach((config) => {
    const value = nextData[config.fieldName];
    const label = nextData[config.labelField];
    if (!hasValue(value) || !isMissingStockDocumentDisplayName(label, value)) {
      return;
    }
    const id = Number(value);
    if (!Number.isFinite(id)) {
      return;
    }
    if (config.type === 'user') {
      missingUserIds.add(id);
    } else {
      missingEntityConfigs.push({ config, id });
    }
  });

  await hydrateUserLabels(missingUserIds, nextData);
  await Promise.all(
    missingEntityConfigs.map(async ({ config, id }) => {
      const label = nextData[config.labelField];
      if (!isMissingStockDocumentDisplayName(label, id)) {
        return;
      }
      const name = await hydrateEntityLabel(id, config.type);
      if (name) {
        nextData[config.labelField] = name;
      }
    }),
  );

  return nextData;
}
