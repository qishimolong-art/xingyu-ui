import type { VbenFormSchema } from '#/adapter/form';

import { getAccount } from '#/api/erp/finance/account';
import { getSupplier } from '#/api/erp/purchase/supplier';
import { getCustomer } from '#/api/erp/sale/customer';
import { getDept } from '#/api/system/dept';
import { getSimpleUserList, getUser } from '#/api/system/user';

const SELECT_POPUP_CLASS = 'finance-document-form-select-dropdown';
const POPUP_COMPONENTS = new Set([
  'ApiSelect',
  'ApiTreeSelect',
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

type FinanceDocumentFormSchema = {
  component?: unknown;
  componentProps?: unknown;
  fieldName?: string;
  rules?: unknown;
};

export type FinanceDocumentHydrationData = {
  accountId?: number | string;
  accountName?: string;
  creator?: number | string;
  creatorName?: string;
  customerCode?: string;
  customerId?: number | string;
  customerName?: string;
  deptId?: number | string;
  deptName?: string;
  financeUserId?: number | string;
  financeUserName?: string;
  handlerId?: number | string;
  handlerName?: string;
  inAccountId?: number | string;
  inAccountName?: string;
  outAccountId?: number | string;
  outAccountName?: string;
  supplierCode?: string;
  supplierId?: number | string;
  supplierName?: string;
};

type FinanceDocumentPrepareOptions = {
  data?: FinanceDocumentHydrationData;
  formType?: string;
};

type FinanceDocumentHydrationOptions = {
  accountOptions?: Record<string, any>[];
  customerOptions?: Record<string, any>[];
  deptOptions?: Record<string, any>[];
  supplierOptions?: Record<string, any>[];
  userOptions?: Record<string, any>[];
};

type DisplayFieldConfig = {
  fieldName: keyof FinanceDocumentHydrationData;
  labelField: keyof FinanceDocumentHydrationData;
  type: 'account' | 'customer' | 'dept' | 'supplier' | 'user';
};

const DISPLAY_FIELD_CONFIGS: DisplayFieldConfig[] = [
  { fieldName: 'accountId', labelField: 'accountName', type: 'account' },
  { fieldName: 'creator', labelField: 'creatorName', type: 'user' },
  { fieldName: 'customerId', labelField: 'customerName', type: 'customer' },
  { fieldName: 'deptId', labelField: 'deptName', type: 'dept' },
  {
    fieldName: 'financeUserId',
    labelField: 'financeUserName',
    type: 'user',
  },
  { fieldName: 'handlerId', labelField: 'handlerName', type: 'user' },
  { fieldName: 'inAccountId', labelField: 'inAccountName', type: 'account' },
  { fieldName: 'outAccountId', labelField: 'outAccountName', type: 'account' },
  { fieldName: 'supplierId', labelField: 'supplierName', type: 'supplier' },
];

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

function isMissingDisplayName(value: unknown, id?: unknown) {
  return !hasValue(value) || (hasValue(id) && `${value}` === `${id}`);
}

function getOptionValue(option: Record<string, any>) {
  return option.value ?? option.id;
}

function getOptionLabel(option: Record<string, any>) {
  return option.label ?? option.name ?? option.nickname;
}

export function mergeFinanceDocumentOption(
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
    `${oldOption.code ?? ''}` === `${nextOption.code ?? ''}` &&
    `${oldOption.name ?? ''}` === `${nextOption.name ?? ''}` &&
    `${oldOption.nickname ?? ''}` === `${nextOption.nickname ?? ''}`
  ) {
    return data;
  }

  const nextData = [...data];
  nextData[index] = nextOption;
  return nextData;
}

function appendPopupClassName(componentProps: Record<string, any> = {}) {
  const popupClassName = [componentProps.popupClassName, SELECT_POPUP_CLASS]
    .filter(Boolean)
    .join(' ');
  return {
    ...componentProps,
    popupClassName,
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

function withCurrentFieldOption(
  componentProps: unknown,
  option: Record<string, any>,
) {
  const enhanceProps = (resolved: Record<string, unknown>) => {
    const originalAfterFetch = resolved.afterFetch;
    return {
      ...resolved,
      options: mergeFinanceDocumentOption(resolved.options, option),
      afterFetch: async (data: unknown) => {
        const fetched =
          typeof originalAfterFetch === 'function'
            ? await originalAfterFetch(data)
            : data;
        return mergeFinanceDocumentOption(fetched, option);
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
  data?: FinanceDocumentHydrationData,
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
  if (!hasValue(value) || !label) {
    return;
  }
  return {
    id: value,
    label,
    name: label,
    ...(fieldName === 'customerId' ? { code: data.customerCode } : {}),
    ...(fieldName === 'supplierId' ? { code: data.supplierCode } : {}),
    ...(config.type === 'user' ? { nickname: label } : {}),
    value,
  };
}

function shouldUseDetailTextField(
  field: FinanceDocumentFormSchema,
  formType?: string,
) {
  return (
    formType === 'detail' &&
    DETAIL_TEXT_FIELD_COMPONENTS.has(String(field.component ?? '')) &&
    DISPLAY_FIELD_CONFIGS.some((config) => config.fieldName === field.fieldName)
  );
}

function toDetailTextField<T extends FinanceDocumentFormSchema>(field: T): T {
  return {
    ...field,
    component: 'Input',
    componentProps: {
      allowClear: false,
      class: 'w-full finance-document-form-readonly-text',
      disabled: true,
      placeholder: '-',
    },
    rules: undefined,
  } as T;
}

export function buildFinanceDocumentFormSchema(
  schema: VbenFormSchema[],
  options: FinanceDocumentPrepareOptions = {},
): VbenFormSchema[] {
  return schema.map((field) => {
    if (shouldUseDetailTextField(field, options.formType)) {
      return toDetailTextField(field);
    }
    if (!POPUP_COMPONENTS.has(String(field.component ?? ''))) {
      return field;
    }
    const option = getCurrentFieldOption(field.fieldName, options.data);
    let componentProps: unknown = withPopupClass(field.componentProps);
    if (option) {
      componentProps = withCurrentFieldOption(componentProps, option);
    }
    return {
      ...field,
      componentProps,
    };
  }) as VbenFormSchema[];
}

export function withCurrentFinanceDocumentSelectOptions<
  T extends FinanceDocumentFormSchema,
>(schema: T[], data?: FinanceDocumentHydrationData) {
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

function getDisplayFieldText(
  data: FinanceDocumentHydrationData,
  config: DisplayFieldConfig,
) {
  const value = data[config.fieldName];
  const label = data[config.labelField];
  if (!hasValue(value)) {
    return '';
  }
  if (!isMissingDisplayName(label, value)) {
    return `${label}`;
  }
  const isNumericId = Number.isFinite(Number(value));
  return isNumericId ? '' : `${value}`;
}

export function getFinanceDocumentDisplayText(
  data: FinanceDocumentHydrationData,
  fieldName: keyof FinanceDocumentHydrationData,
) {
  const config = DISPLAY_FIELD_CONFIGS.find(
    (item) => item.fieldName === fieldName,
  );
  if (!config) {
    return '';
  }
  return getDisplayFieldText(data, config);
}

export function buildFinanceDocumentDetailFormValues<T extends object>(
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

function findOptionName(
  options: Record<string, any>[] | undefined,
  id: unknown,
) {
  if (!hasValue(id) || !Array.isArray(options)) {
    return;
  }
  const option = options.find((item) => {
    const itemValue = item?.value ?? item?.id;
    return `${itemValue}` === `${id}`;
  });
  return getOptionLabel(option || {});
}

function getUserDisplayName(user: { nickname?: string; username?: string }) {
  return user.nickname || user.username;
}

async function hydrateUserLabels(
  ids: Set<number>,
  target: Record<string, unknown>,
  userOptions?: Record<string, any>[],
) {
  if (ids.size === 0) {
    return;
  }
  const userNameMap = new Map<number, string>();
  userOptions?.forEach((user) => {
    const value = user?.value ?? user?.id;
    if (!hasValue(value)) {
      return;
    }
    const name = getUserDisplayName(user);
    if (name) {
      userNameMap.set(Number(value), name);
    }
  });
  const missingFromOptions = [...ids].filter((id) => !userNameMap.has(id));
  if (missingFromOptions.length > 0) {
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
  }
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
      if (!hasValue(value) || !isMissingDisplayName(label, value)) {
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
  if (type === 'account') {
    return (await getAccount(id).catch(() => undefined))?.name;
  }
  if (type === 'customer') {
    return (await getCustomer(id).catch(() => undefined))?.name;
  }
  if (type === 'dept') {
    return (await getDept(id).catch(() => undefined))?.name;
  }
  if (type === 'supplier') {
    return (await getSupplier(id).catch(() => undefined))?.name;
  }
  return undefined;
}

function getOptionsByType(
  options: FinanceDocumentHydrationOptions,
  type: DisplayFieldConfig['type'],
) {
  if (type === 'account') {
    return options.accountOptions;
  }
  if (type === 'customer') {
    return options.customerOptions;
  }
  if (type === 'dept') {
    return options.deptOptions;
  }
  if (type === 'supplier') {
    return options.supplierOptions;
  }
  if (type === 'user') {
    return options.userOptions;
  }
  return undefined;
}

export async function hydrateFinanceDocumentFormSelectLabels<
  T extends FinanceDocumentHydrationData,
>(data: T, options: FinanceDocumentHydrationOptions = {}): Promise<T> {
  const nextData = { ...data } as T & Record<string, unknown>;
  const missingUserIds = new Set<number>();
  const missingEntityConfigs: Array<{
    config: DisplayFieldConfig;
    id: number;
  }> = [];

  DISPLAY_FIELD_CONFIGS.forEach((config) => {
    const value = nextData[config.fieldName];
    const label = nextData[config.labelField];
    if (!hasValue(value) || !isMissingDisplayName(label, value)) {
      return;
    }
    const optionName = findOptionName(
      getOptionsByType(options, config.type),
      value,
    );
    if (optionName) {
      nextData[config.labelField] = optionName;
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

  await hydrateUserLabels(missingUserIds, nextData, options.userOptions);
  await Promise.all(
    missingEntityConfigs.map(async ({ config, id }) => {
      const label = nextData[config.labelField];
      if (!isMissingDisplayName(label, id)) {
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
