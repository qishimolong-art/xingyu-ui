import { getSupplier } from '#/api/erp/purchase/supplier';
import { getDept } from '#/api/system/dept';
import { getSimpleUserList, getUser } from '#/api/system/user';

type PurchaseDocumentFormSchema = {
  component?: unknown;
  componentProps?: unknown;
  fieldName?: string;
};

type PurchaseSupplierHydrationData = {
  adjuster?: number | string;
  adjusterName?: string;
  accountant?: number | string;
  accountantName?: string;
  creator?: number | string;
  creatorName?: string;
  deptId?: number | string;
  deptName?: string;
  handler?: number | string;
  handlerId?: number | string;
  handlerName?: string;
  items?: unknown[];
  purchaser?: number | string;
  purchaserName?: string;
  supplierId?: number | string;
  supplierName?: string;
  supplierPayableInfo?: unknown;
  supplierType?: string;
};

type PurchaseDocumentPrepareOptions = {
  data?: PurchaseSupplierHydrationData;
  formType?: string;
};

type PurchaseCurrentUserData = {
  deptId?: number | string;
  deptName?: string;
  id?: number | string;
  name?: string;
  nickname?: string;
  username?: string;
};

type PurchaseCurrentUserField =
  | 'accountant'
  | 'adjuster'
  | 'creator'
  | 'handler'
  | 'handlerId'
  | 'purchaser';

type DisplayFieldConfig = {
  fieldName: keyof PurchaseSupplierHydrationData;
  labelField: keyof PurchaseSupplierHydrationData;
  type: 'dept' | 'supplier' | 'user';
};

const EMBEDDED_SECTION_FIELDS = new Set(['supplierPayableInfo', 'items']);
const POPUP_COMPONENTS = new Set([
  'ApiSelect',
  'ApiTreeSelect',
  'Cascader',
  'ErpLazyPageSelect',
  'Select',
  'SupplierLazySelect',
  'TreeSelect',
]);
const DETAIL_TEXT_FIELD_COMPONENTS = new Set([
  'ErpLazyPageSelect',
  'SupplierLazySelect',
]);
const DISPLAY_FIELD_CONFIGS: DisplayFieldConfig[] = [
  { fieldName: 'accountant', labelField: 'accountantName', type: 'user' },
  { fieldName: 'adjuster', labelField: 'adjusterName', type: 'user' },
  { fieldName: 'creator', labelField: 'creatorName', type: 'user' },
  { fieldName: 'deptId', labelField: 'deptName', type: 'dept' },
  { fieldName: 'handler', labelField: 'handlerName', type: 'user' },
  { fieldName: 'handlerId', labelField: 'handlerName', type: 'user' },
  { fieldName: 'purchaser', labelField: 'purchaserName', type: 'user' },
  { fieldName: 'supplierId', labelField: 'supplierName', type: 'supplier' },
];

function appendPopupClass(value: unknown) {
  const current = typeof value === 'string' ? value.trim() : '';
  return [current, 'purchase-document-form-select-dropdown']
    .filter(Boolean)
    .join(' ');
}

function withPopupClass(componentProps: unknown) {
  if (typeof componentProps === 'function') {
    return (...args: unknown[]) => {
      const resolved = componentProps(...args) as Record<string, unknown>;
      return {
        ...(resolved && typeof resolved === 'object' ? resolved : {}),
        popupClassName: appendPopupClass(resolved?.popupClassName),
      };
    };
  }
  const resolved =
    componentProps && typeof componentProps === 'object'
      ? (componentProps as Record<string, unknown>)
      : {};
  return {
    ...resolved,
    popupClassName: appendPopupClass(resolved.popupClassName),
  };
}

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

function getPurchaseSupplierOption(data?: PurchaseSupplierHydrationData) {
  if (
    !hasValue(data?.supplierId) ||
    !data?.supplierName ||
    isMissingDisplayName(data.supplierName, data.supplierId)
  ) {
    return;
  }
  return {
    id: data.supplierId,
    label: data.supplierName,
    name: data.supplierName,
    value: data.supplierId,
  };
}

function mergePurchaseSupplierOption(
  data: unknown,
  option: Record<string, any>,
) {
  return mergeOption(data, option);
}

function mergeOption(data: unknown, option: Record<string, any>) {
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

function withPurchaseSupplierOption(
  componentProps: unknown,
  supplier?: PurchaseSupplierHydrationData,
) {
  const option = getPurchaseSupplierOption(supplier);
  if (!option) {
    return componentProps;
  }

  const enhanceProps = (resolved: Record<string, unknown>) => {
    const originalAfterFetch = resolved.afterFetch;
    return {
      ...resolved,
      options: mergePurchaseSupplierOption(resolved.options, option),
      afterFetch: async (data: unknown) => {
        const fetched =
          typeof originalAfterFetch === 'function'
            ? await originalAfterFetch(data)
            : data;
        return mergePurchaseSupplierOption(fetched, option);
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

/**
 * Keep the configured field order while moving payable information and item
 * rows into their dedicated document sections.
 */
export function preparePurchaseDocumentFormSchema<
  T extends PurchaseDocumentFormSchema,
>(schema: T[], options: PurchaseDocumentPrepareOptions = {}) {
  return schema
    .filter((field) => !EMBEDDED_SECTION_FIELDS.has(field.fieldName ?? ''))
    .map((field) => {
      if (shouldUseDetailTextField(field, options.formType)) {
        return toDetailTextField(field);
      }
      if (!POPUP_COMPONENTS.has(String(field.component ?? ''))) {
        return field;
      }
      return {
        ...field,
        componentProps: withPopupClass(field.componentProps),
      };
    }) as T[];
}

function shouldUseDetailTextField(
  field: PurchaseDocumentFormSchema,
  formType?: string,
) {
  return (
    formType === 'detail' &&
    DETAIL_TEXT_FIELD_COMPONENTS.has(String(field.component ?? '')) &&
    DISPLAY_FIELD_CONFIGS.some((config) => config.fieldName === field.fieldName)
  );
}

function toDetailTextField<T extends PurchaseDocumentFormSchema>(field: T): T {
  return {
    ...field,
    component: 'Input',
    componentProps: {
      class: 'w-full purchase-document-form-readonly-text',
      disabled: true,
      placeholder: '-',
    },
    rules: undefined,
  } as T;
}

export function withCurrentPurchaseSupplierOption<
  T extends PurchaseDocumentFormSchema,
>(schema: T[], supplier?: PurchaseSupplierHydrationData) {
  return schema.map((field) => {
    if (field.fieldName !== 'supplierId') {
      return field;
    }
    return {
      ...field,
      componentProps: withPurchaseSupplierOption(
        field.componentProps,
        supplier,
      ),
    };
  }) as T[];
}

function getCurrentFieldOption(
  fieldName: string | undefined,
  data?: PurchaseSupplierHydrationData,
) {
  if (!data || !fieldName) {
    return;
  }
  const optionMap: Record<string, { label?: string; value?: number | string }> =
    {
      accountant: { label: data.accountantName, value: data.accountant },
      adjuster: { label: data.adjusterName, value: data.adjuster },
      creator: { label: data.creatorName, value: data.creator },
      deptId: { label: data.deptName, value: data.deptId },
      handler: { label: data.handlerName, value: data.handler },
      handlerId: { label: data.handlerName, value: data.handlerId },
      purchaser: { label: data.purchaserName, value: data.purchaser },
    };
  const option = optionMap[fieldName];
  if (!hasValue(option?.value) || !option?.label) {
    return;
  }
  return {
    id: option.value,
    label: option.label,
    name: option.label,
    nickname: option.label,
    value: option.value,
  };
}

function withCurrentFieldOption(
  componentProps: unknown,
  option: Record<string, any>,
) {
  const enhanceProps = (resolved: Record<string, unknown>) => {
    const originalAfterFetch = resolved.afterFetch;
    return {
      ...resolved,
      options: mergeOption(resolved.options, option),
      afterFetch: async (data: unknown) => {
        const fetched =
          typeof originalAfterFetch === 'function'
            ? await originalAfterFetch(data)
            : data;
        return mergeOption(fetched, option);
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

export function withCurrentPurchaseFormSelectOptions<
  T extends PurchaseDocumentFormSchema,
>(schema: T[], data?: PurchaseSupplierHydrationData) {
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

function getUserDisplayName(user: { nickname?: string; username?: string }) {
  return user.nickname || user.username;
}

function getCurrentUserDisplayName(user?: null | PurchaseCurrentUserData) {
  return user?.nickname || user?.name || user?.username;
}

export function buildPurchaseCurrentUserFormDefaults(
  user?: null | PurchaseCurrentUserData,
  fields: PurchaseCurrentUserField[] = [],
  options: { includeDept?: boolean } = {},
): Record<string, any> {
  if (!user || !hasValue(user.id)) {
    return {};
  }

  const id = user.id;
  const name = getCurrentUserDisplayName(user);
  const defaults: Record<string, unknown> = {};
  fields.forEach((field) => {
    defaults[field] = id;
    if (name) {
      const config = DISPLAY_FIELD_CONFIGS.find(
        (item) => item.fieldName === field,
      );
      if (config) {
        defaults[config.labelField] = name;
      }
    }
  });

  if (options.includeDept && hasValue(user.deptId)) {
    defaults.deptId = user.deptId;
    if (user.deptName) {
      defaults.deptName = user.deptName;
    }
  }
  return defaults;
}

function getDisplayFieldText(
  data: PurchaseSupplierHydrationData,
  config: DisplayFieldConfig,
) {
  const value = data[config.fieldName];
  const label = data[config.labelField];
  if (!hasValue(value)) {
    return '';
  }
  return isMissingDisplayName(label, value) ? '' : `${label}`;
}

export function buildPurchaseDocumentDetailFormValues<T extends object>(
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

export async function hydratePurchaseDocumentFormSelectLabels<
  T extends PurchaseSupplierHydrationData,
>(data: T): Promise<T> {
  const nextData = { ...data };
  const missingUserIds = new Set<number>();
  const missingDeptIds = new Set<number>();
  const missingSupplierIds = new Set<number>();

  DISPLAY_FIELD_CONFIGS.forEach((config) => {
    const value = nextData[config.fieldName];
    const label = nextData[config.labelField];
    if (!hasValue(value) || !isMissingDisplayName(label, value)) {
      return;
    }
    const id = Number(value);
    if (!Number.isFinite(id)) {
      return;
    }
    if (config.type === 'dept') {
      missingDeptIds.add(id);
    } else if (config.type === 'supplier') {
      missingSupplierIds.add(id);
    } else {
      missingUserIds.add(id);
    }
  });

  const userNameMap = new Map<number, string>();
  if (missingUserIds.size > 0) {
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
    const missingIds = [...missingUserIds].filter((id) => !userNameMap.has(id));
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
  }

  const deptNameMap = new Map<number, string>();
  if (missingDeptIds.size > 0) {
    const depts = await Promise.all(
      [...missingDeptIds].map((id) => getDept(id).catch(() => undefined)),
    );
    depts.forEach((dept) => {
      if (dept?.id && dept.name) {
        deptNameMap.set(Number(dept.id), dept.name);
      }
    });
  }

  const supplierNameMap = new Map<number, string>();
  if (missingSupplierIds.size > 0) {
    const suppliers = await Promise.all(
      [...missingSupplierIds].map((id) =>
        getSupplier(id).catch(() => undefined),
      ),
    );
    suppliers.forEach((supplier) => {
      if (supplier?.id && supplier.name) {
        supplierNameMap.set(Number(supplier.id), supplier.name);
      }
    });
  }

  DISPLAY_FIELD_CONFIGS.forEach((config) => {
    const value = nextData[config.fieldName];
    const label = nextData[config.labelField];
    if (!hasValue(value) || !isMissingDisplayName(label, value)) {
      return;
    }
    const id = Number(value);
    const name =
      config.type === 'dept'
        ? deptNameMap.get(id)
        : config.type === 'supplier'
          ? supplierNameMap.get(id)
          : userNameMap.get(id);
    if (name) {
      (nextData as Record<string, unknown>)[String(config.labelField)] = name;
    }
  });

  return nextData;
}

export function hydratePurchaseSupplierFromFallback<
  T extends PurchaseSupplierHydrationData,
>(target: T, fallback?: PurchaseSupplierHydrationData): T {
  if (!fallback) {
    return target;
  }

  const targetItems = Array.isArray(target.items) ? target.items : [];
  const fallbackItems = Array.isArray(fallback.items) ? fallback.items : [];

  return {
    ...target,
    items:
      targetItems.length > 0 || fallbackItems.length === 0
        ? target.items
        : fallbackItems,
    supplierId: target.supplierId ?? fallback.supplierId,
    supplierName: target.supplierName ?? fallback.supplierName,
    supplierPayableInfo:
      target.supplierPayableInfo ?? fallback.supplierPayableInfo,
    supplierType: target.supplierType ?? fallback.supplierType,
  };
}
