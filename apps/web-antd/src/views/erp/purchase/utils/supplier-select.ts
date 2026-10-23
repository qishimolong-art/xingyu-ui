import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';

import {
  getSupplierSimpleList,
  getSupplierSimplePage,
} from '#/api/erp/purchase/supplier';

export const SUPPLIER_SELECT_PAGE_SIZE = 10;

export interface SupplierOption extends ErpSupplierApi.Supplier {
  label?: string;
  value?: number;
}

export function formatSupplierOption(
  supplier: ErpSupplierApi.Supplier,
): SupplierOption {
  return {
    ...supplier,
    label: supplier.name ?? '',
    value: supplier.id,
  };
}

export async function getSupplierSelectOptions() {
  const list = await getSupplierSimpleList();
  return (list || []).map(formatSupplierOption);
}

export async function getSupplierSelectPage(params: {
  keyword?: string;
  pageNo: number;
  pageSize?: number;
}) {
  const page = await getSupplierSimplePage({
    ...params,
    pageSize: params.pageSize || SUPPLIER_SELECT_PAGE_SIZE,
  });
  return {
    ...page,
    list: (page?.list || []).map(formatSupplierOption),
  };
}

export function getSupplierSelectProps(
  disabled = false,
  popupClassName?: string,
) {
  return {
    placeholder: '请选择供应商',
    allowClear: true,
    showSearch: true,
    pageSize: SUPPLIER_SELECT_PAGE_SIZE,
    disabled,
    ...(popupClassName ? { popupClassName } : {}),
  };
}
