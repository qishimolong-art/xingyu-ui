import type { ErpCustomerApi } from '#/api/erp/sale/customer';

import { getCustomerSimplePage } from '#/api/erp/sale/customer';

export const CUSTOMER_SELECT_PAGE_SIZE = 10;

export interface CustomerOption extends ErpCustomerApi.Customer {
  label?: string;
  value?: number;
}

export function formatCustomerOption(
  customer: ErpCustomerApi.Customer,
): CustomerOption {
  return {
    ...customer,
    label: customer.name ?? '',
    value: customer.id,
  };
}

export async function getCustomerSelectPage(params: {
  keyword?: string;
  pageNo: number;
  pageSize?: number;
}) {
  const page = await getCustomerSimplePage({
    ...params,
    pageSize: params.pageSize || CUSTOMER_SELECT_PAGE_SIZE,
  });
  return {
    ...page,
    list: (page?.list || []).map(formatCustomerOption),
  };
}

export function getCustomerSelectProps(
  disabled = false,
  popupClassName?: string,
) {
  return {
    placeholder: '请选择客户',
    allowClear: true,
    showSearch: true,
    pageSize: CUSTOMER_SELECT_PAGE_SIZE,
    disabled,
    ...(popupClassName ? { popupClassName } : {}),
  };
}

type CustomerHydrationData = {
  customerCode?: string;
  customerId?: number | string;
  customerName?: string;
};

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

function getCurrentCustomerOption(data?: CustomerHydrationData) {
  if (!hasValue(data?.customerId) || !data?.customerName) {
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

export function mergeCustomerOption(
  data: unknown,
  option: Record<string, any>,
) {
  if (data === undefined || data === null) {
    return [option];
  }
  if (!Array.isArray(data)) {
    return data;
  }
  const optionValue = option.value ?? option.id;
  const exists = data.some((item) => {
    const itemValue = item?.value ?? item?.id;
    return `${itemValue}` === `${optionValue}`;
  });
  return exists ? data : [option, ...data];
}

export function withCurrentCustomerOption<
  T extends { componentProps?: unknown; fieldName?: string },
>(schema: T[], customer?: CustomerHydrationData) {
  const option = getCurrentCustomerOption(customer);
  if (!option) {
    return schema;
  }
  return schema.map((field) => {
    if (field.fieldName !== 'customerId') {
      return field;
    }
    const componentProps =
      field.componentProps && typeof field.componentProps === 'object'
        ? (field.componentProps as Record<string, unknown>)
        : {};
    return {
      ...field,
      componentProps: {
        ...componentProps,
        options: mergeCustomerOption(componentProps.options, option),
      },
    };
  }) as T[];
}
