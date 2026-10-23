import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSupplierBusinessInfoApi {
  export interface SupplierBusinessInfo {
    id?: number;
    supplierId: number;
    companyName?: string;
    creditCode?: string;
    legalPerson?: string;
    registeredAddress?: string;
    businessScope?: string;
    registeredCapital?: string;
    establishDate?: string;
    businessStatus?: string;
    rawData?: string;
    remark?: string;
    createTime?: string;
  }
}

export function getSupplierBusinessInfoList(supplierId: number) {
  return requestClient.get<ErpSupplierBusinessInfoApi.SupplierBusinessInfo[]>(
    '/erp/supplier-business-info/list',
    { params: { supplierId } },
  );
}

export function getSupplierBusinessInfo(id: number) {
  return requestClient.get<ErpSupplierBusinessInfoApi.SupplierBusinessInfo>(
    `/erp/supplier-business-info/get?id=${id}`,
  );
}

export function createSupplierBusinessInfo(
  data: ErpSupplierBusinessInfoApi.SupplierBusinessInfo,
) {
  return requestClient.post('/erp/supplier-business-info/create', data);
}

export function updateSupplierBusinessInfo(
  data: ErpSupplierBusinessInfoApi.SupplierBusinessInfo,
) {
  return requestClient.put('/erp/supplier-business-info/update', data);
}

export function deleteSupplierBusinessInfo(id: number) {
  return requestClient.delete(`/erp/supplier-business-info/delete?id=${id}`);
}

export function getSupplierBusinessInfoPage(
  params: PageParam & { supplierId: number },
) {
  return requestClient.get<
    PageResult<ErpSupplierBusinessInfoApi.SupplierBusinessInfo>
  >('/erp/supplier-business-info/page', { params });
}
