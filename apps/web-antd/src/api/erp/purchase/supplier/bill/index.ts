import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSupplierBillApi {
  export interface SupplierBill {
    id?: number;
    supplierId: number;
    billDate: string;
    billNo: string;
    amount: number;
    remark?: string;
    createTime?: string;
  }
}

export function getSupplierBillList(supplierId: number) {
  return requestClient.get<ErpSupplierBillApi.SupplierBill[]>(
    '/erp/supplier-bill/list',
    { params: { supplierId } },
  );
}

export function getSupplierBill(id: number) {
  return requestClient.get<ErpSupplierBillApi.SupplierBill>(
    `/erp/supplier-bill/get?id=${id}`,
  );
}

export function createSupplierBill(data: ErpSupplierBillApi.SupplierBill) {
  return requestClient.post('/erp/supplier-bill/create', data);
}

export function updateSupplierBill(data: ErpSupplierBillApi.SupplierBill) {
  return requestClient.put('/erp/supplier-bill/update', data);
}

export function deleteSupplierBill(id: number) {
  return requestClient.delete(`/erp/supplier-bill/delete?id=${id}`);
}

export function getSupplierBillPage(
  params: PageParam & { supplierId: number },
) {
  return requestClient.get<PageResult<ErpSupplierBillApi.SupplierBill>>(
    '/erp/supplier-bill/page',
    { params },
  );
}
