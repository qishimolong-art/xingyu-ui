import type { ErpCustomerApi } from '#/api/erp/sale/customer';

import { getSaleCustomerSimplePage } from '#/api/erp/sale/customer';
import { filterErpBusinessPartnerOption } from '#/views/erp/utils/business-partner-select';

export const SALE_CUSTOMER_SELECT_PAGE_SIZE = 10;

export interface SaleCustomerOption extends ErpCustomerApi.Customer {
  label?: string;
  value?: number;
  disabled?: boolean;
}

export function formatSaleCustomerOption(
  customer: ErpCustomerApi.Customer,
): SaleCustomerOption {
  const blockedReason = customer.creditBlockedReason
    ? `（${customer.creditBlockedReason}）`
    : '';
  return {
    ...customer,
    label: `${customer.name ?? ''}${customer.creditBlocked ? ` - 授信超限${blockedReason}` : ''}`,
    value: customer.id,
    disabled: Boolean(customer.disabled || customer.creditBlocked),
  };
}

export async function getSaleCustomerSelectPage(params: {
  keyword?: string;
  pageNo: number;
  pageSize?: number;
}) {
  const page = await getSaleCustomerSimplePage({
    ...params,
    pageSize: params.pageSize || SALE_CUSTOMER_SELECT_PAGE_SIZE,
  });
  return {
    ...page,
    list: (page?.list || []).map(formatSaleCustomerOption),
  };
}

export function filterSaleCustomerOption(input: string, option: any) {
  return filterErpBusinessPartnerOption(input, option);
}

export function getSaleCustomerSelectProps(disabled = false) {
  return {
    placeholder: '请选择客户',
    allowClear: true,
    showSearch: true,
    pageSize: SALE_CUSTOMER_SELECT_PAGE_SIZE,
    disabled,
  };
}
