import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSupplierAccountApi {
  export interface SupplierAccount {
    id?: number;
    supplierId: number;
    accountName: string;
    cardNo: string;
    bankName?: string;
    defaulted?: boolean;
    sort?: number;
    remark?: string;
    createTime?: string;
  }
}

export function getSupplierAccountList(supplierId: number) {
  return requestClient.get<ErpSupplierAccountApi.SupplierAccount[]>(
    '/erp/supplier-account/list',
    { params: { supplierId } },
  );
}

export function getSupplierAccount(id: number) {
  return requestClient.get<ErpSupplierAccountApi.SupplierAccount>(
    `/erp/supplier-account/get?id=${id}`,
  );
}

export function createSupplierAccount(
  data: ErpSupplierAccountApi.SupplierAccount,
) {
  return requestClient.post('/erp/supplier-account/create', data);
}

export function updateSupplierAccount(
  data: ErpSupplierAccountApi.SupplierAccount,
) {
  return requestClient.put('/erp/supplier-account/update', data);
}

export function deleteSupplierAccount(id: number) {
  return requestClient.delete(`/erp/supplier-account/delete?id=${id}`);
}

export function getSupplierAccountPage(
  params: PageParam & { supplierId: number },
) {
  return requestClient.get<PageResult<ErpSupplierAccountApi.SupplierAccount>>(
    '/erp/supplier-account/page',
    { params },
  );
}
