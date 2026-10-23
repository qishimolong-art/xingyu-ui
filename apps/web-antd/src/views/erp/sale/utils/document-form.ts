import { getCustomer } from '#/api/erp/sale/customer';
import { getDept } from '#/api/system/dept';
import { getUser } from '#/api/system/user';

type SaleDocumentFormSchema = {
  component?: unknown;
  componentProps?: unknown;
  fieldName?: string;
};

type SaleCustomerHydrationData = {
  customerCode?: string;
  customerId?: number | string;
  customerName?: string;
  deptId?: number | string;
  deptName?: string;
  saleUserId?: number | string;
  saleUserName?: string;
  adjustUserId?: number | string;
  adjustUserName?: string;
  developerUserId?: number | string;
  developerUserName?: string;
  handler?: number | string;
  handlerName?: string;
  items?: unknown[];
};

type SaleCurrentUserData = {
  id?: number | string;
  name?: string;
  nickname?: string;
  username?: string;
};

type SaleCurrentUserField =
  | 'adjustUserId'
  | 'developerUserId'
  | 'handler'
  | 'saleUserId';

type DisplayFieldConfig = {
  fieldName: keyof SaleCustomerHydrationData;
  labelField: keyof SaleCustomerHydrationData;
  type: 'customer' | 'dept' | 'user';
};

const DETAIL_TEXT_FIELD_COMPONENTS = new Set([
  'CustomerLazySelect',
  'ErpLazyPageSelect',
  'SaleCustomerLazySelect',
]);

const DISPLAY_FIELD_CONFIGS: DisplayFieldConfig[] = [
  { fieldName: 'adjustUserId', labelField: 'adjustUserName', type: 'user' },
  { fieldName: 'customerId', labelField: 'customerName', type: 'customer' },
  { fieldName: 'deptId', labelField: 'deptName', type: 'dept' },
  {
    fieldName: 'developerUserId',
    labelField: 'developerUserName',
    type: 'user',
  },
  { fieldName: 'handler', labelField: 'handlerName', type: 'user' },
  { fieldName: 'saleUserId', labelField: 'saleUserName', type: 'user' },
];

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

function isMissingDisplayName(value: unknown, id?: unknown) {
  return !hasValue(value) || (hasValue(id) && `${value}` === `${id}`);
}

function toNumberId(value: number | string | undefined) {
  if (!hasValue(value)) {
    return;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function resolveUserLabel(user: Record<string, any> | undefined) {
  return user?.nickname || user?.name || user?.username;
}

export function buildSaleCurrentUserFormDefaults(
  user?: null | SaleCurrentUserData,
  fields: SaleCurrentUserField[] = [],
): Record<string, any> {
  if (!user || !hasValue(user.id)) {
    return {};
  }

  const defaults: Record<string, unknown> = {};
  const name = resolveUserLabel(user);
  fields.forEach((fieldName) => {
    defaults[fieldName] = user.id;
    if (name) {
      const config = DISPLAY_FIELD_CONFIGS.find(
        (item) => item.fieldName === fieldName,
      );
      if (config) {
        defaults[config.labelField] = name;
      }
    }
  });
  return defaults;
}

export async function hydrateCurrentSaleFormSelectNames<
  T extends SaleCustomerHydrationData | undefined,
>(data: T): Promise<T> {
  if (!data) {
    return data;
  }

  const userFields = [
    ['saleUserId', 'saleUserName'],
    ['adjustUserId', 'adjustUserName'],
    ['developerUserId', 'developerUserName'],
    ['handler', 'handlerName'],
  ] as const;
  const missingUserIds = new Set<number>();
  userFields.forEach(([idKey, nameKey]) => {
    const userId = toNumberId(data[idKey]);
    if (userId && isMissingDisplayName(data[nameKey], userId)) {
      missingUserIds.add(userId);
    }
  });

  const [customer, dept, ...users] = await Promise.all([
    toNumberId(data.customerId) &&
    isMissingDisplayName(data.customerName, data.customerId)
      ? getCustomer(toNumberId(data.customerId) as number).catch(
          () => undefined,
        )
      : Promise.resolve(undefined),
    toNumberId(data.deptId) && isMissingDisplayName(data.deptName, data.deptId)
      ? getDept(toNumberId(data.deptId) as number).catch(() => undefined)
      : Promise.resolve(undefined),
    ...Array.from(missingUserIds).map((userId) =>
      getUser(userId)
        .then((user) => [userId, user] as const)
        .catch(() => [userId, undefined] as const),
    ),
  ]);

  if (customer?.name) {
    data.customerName = customer.name;
    data.customerCode = data.customerCode ?? customer.code;
  }

  if (dept?.name) {
    data.deptName = dept.name;
  }

  const userMap = new Map(
    users.map(([userId, user]) => [String(userId), resolveUserLabel(user)]),
  );
  userFields.forEach(([idKey, nameKey]) => {
    const userId = toNumberId(data[idKey]);
    const label = userId ? userMap.get(String(userId)) : undefined;
    if (label && isMissingDisplayName(data[nameKey], userId)) {
      data[nameKey] = label;
    }
  });

  return data;
}

function getSaleCustomerOption(data?: SaleCustomerHydrationData) {
  if (
    !hasValue(data?.customerId) ||
    !data?.customerName ||
    isMissingDisplayName(data.customerName, data.customerId)
  ) {
    return;
  }
  return {
    code: data.customerCode,
    id: data.customerId,
    label: data.customerName,
    name: data.customerName,
    value: data.customerId,
  };
}

function mergeSaleCustomerOption(data: unknown, option: Record<string, any>) {
  if (data === undefined || data === null) {
    return [option];
  }
  if (!Array.isArray(data)) {
    return data;
  }
  const optionValue = option.value ?? option.id;
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
    `${oldOption.value ?? oldOption.id ?? ''}` ===
      `${nextOption.value ?? nextOption.id ?? ''}` &&
    `${oldOption.label ?? oldOption.name ?? oldOption.nickname ?? ''}` ===
      `${nextOption.label ?? nextOption.name ?? nextOption.nickname ?? ''}` &&
    `${oldOption.name ?? ''}` === `${nextOption.name ?? ''}` &&
    `${oldOption.nickname ?? ''}` === `${nextOption.nickname ?? ''}`
  ) {
    return data;
  }
  const nextData = [...data];
  nextData[index] = nextOption;
  return nextData;
}

function withSaleCustomerOption(
  componentProps: unknown,
  customer?: SaleCustomerHydrationData,
) {
  const option = getSaleCustomerOption(customer);
  if (!option) {
    return componentProps;
  }

  const enhanceProps = (resolved: Record<string, unknown>) => {
    const originalAfterFetch = resolved.afterFetch;
    return {
      ...resolved,
      options: mergeSaleCustomerOption(resolved.options, option),
      afterFetch: async (data: unknown) => {
        const fetched =
          typeof originalAfterFetch === 'function'
            ? await originalAfterFetch(data)
            : data;
        return mergeSaleCustomerOption(fetched, option);
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

export function withCurrentSaleCustomerOption<T extends SaleDocumentFormSchema>(
  schema: T[],
  customer?: SaleCustomerHydrationData,
) {
  return schema.map((field) => {
    if (field.fieldName !== 'customerId') {
      return field;
    }
    return {
      ...field,
      componentProps: withSaleCustomerOption(field.componentProps, customer),
    };
  }) as T[];
}

function getFieldOption(fieldName?: string, data?: SaleCustomerHydrationData) {
  const optionMap: Record<string, { label?: string; value?: number | string }> =
    {
      adjustUserId: {
        label: data?.adjustUserName,
        value: data?.adjustUserId,
      },
      deptId: {
        label: data?.deptName,
        value: data?.deptId,
      },
      developerUserId: {
        label: data?.developerUserName,
        value: data?.developerUserId,
      },
      handler: {
        label: data?.handlerName,
        value: data?.handler,
      },
      saleUserId: {
        label: data?.saleUserName,
        value: data?.saleUserId,
      },
    };
  const current = fieldName ? optionMap[fieldName] : undefined;
  if (
    !hasValue(current?.value) ||
    !current?.label ||
    isMissingDisplayName(current.label, current.value)
  ) {
    return;
  }
  return {
    id: current.value,
    label: current.label,
    name: current.label,
    nickname: current.label,
    value: current.value,
  };
}

function withCurrentFieldOption(
  componentProps: unknown,
  option?: Record<string, any>,
) {
  if (!option) {
    return componentProps;
  }
  const enhanceProps = (resolved: Record<string, unknown>) => {
    const originalAfterFetch = resolved.afterFetch;
    return {
      ...resolved,
      options: mergeSaleCustomerOption(resolved.options, option),
      afterFetch: async (data: unknown) => {
        const fetched =
          typeof originalAfterFetch === 'function'
            ? await originalAfterFetch(data)
            : data;
        return mergeSaleCustomerOption(fetched, option);
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

function shouldUseDetailTextField(
  field: SaleDocumentFormSchema,
  formType?: string,
) {
  return (
    formType === 'detail' &&
    DETAIL_TEXT_FIELD_COMPONENTS.has(String(field.component ?? '')) &&
    DISPLAY_FIELD_CONFIGS.some((config) => config.fieldName === field.fieldName)
  );
}

function toDetailTextField<T extends SaleDocumentFormSchema>(field: T): T {
  return {
    ...field,
    component: 'Input',
    componentProps: {
      class: 'w-full sale-document-form-readonly-text',
      disabled: true,
      placeholder: '-',
    },
    rules: undefined,
  } as T;
}

export function withCurrentSaleFormSelectOptions<
  T extends SaleDocumentFormSchema,
>(schema: T[], data?: SaleCustomerHydrationData, formType?: string) {
  return withCurrentSaleCustomerOption(schema, data).map((field) => {
    const option = getFieldOption(field.fieldName, data);
    const nextField = option
      ? {
          ...field,
          componentProps: withCurrentFieldOption(field.componentProps, option),
        }
      : field;
    return shouldUseDetailTextField(nextField, formType)
      ? toDetailTextField(nextField)
      : nextField;
  }) as T[];
}

function getDisplayFieldText(
  data: SaleCustomerHydrationData,
  config: DisplayFieldConfig,
) {
  const value = data[config.fieldName];
  const label = data[config.labelField];
  if (!hasValue(value)) {
    return '';
  }
  return isMissingDisplayName(label, value) ? '' : `${label}`;
}

export function buildSaleDocumentDetailFormValues<T extends object>(
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

export function hydrateSaleCustomerFromFallback<
  T extends SaleCustomerHydrationData,
>(target: T, fallback?: SaleCustomerHydrationData): T {
  if (!fallback) {
    return target;
  }

  const targetItems = Array.isArray(target.items) ? target.items : [];
  const fallbackItems = Array.isArray(fallback.items) ? fallback.items : [];

  return {
    ...target,
    customerCode: target.customerCode ?? fallback.customerCode,
    customerId: target.customerId ?? fallback.customerId,
    customerName: target.customerName ?? fallback.customerName,
    items:
      targetItems.length > 0 || fallbackItems.length === 0
        ? target.items
        : fallbackItems,
  };
}

export function withSaleCustomerFromSource<T extends SaleCustomerHydrationData>(
  target: T,
  source?: SaleCustomerHydrationData,
): T {
  if (!source || !hasValue(source.customerId)) {
    return target;
  }

  const isSameCustomer =
    hasValue(target.customerId) &&
    `${target.customerId}` === `${source.customerId}`;
  return {
    ...target,
    customerCode:
      source.customerCode ?? (isSameCustomer ? target.customerCode : undefined),
    customerId: source.customerId,
    customerName:
      source.customerName ?? (isSameCustomer ? target.customerName : undefined),
  };
}
