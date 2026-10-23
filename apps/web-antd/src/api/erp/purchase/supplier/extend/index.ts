import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSupplierExtendApi {
  export interface SupplierExtend {
    id?: number;
    supplierId: number;
    extendKey: string;
    extendName?: string;
    extendValue?: string;
    extendType?: string;
    required?: boolean;
    optionValues?: string;
    sort?: number;
    remark?: string;
    createTime?: string;
  }
}

export function getSupplierExtendList(supplierId: number) {
  return requestClient.get<ErpSupplierExtendApi.SupplierExtend[]>(
    '/erp/supplier-extend/list',
    { params: { supplierId } },
  );
}

export function getSupplierExtend(id: number) {
  return requestClient.get<ErpSupplierExtendApi.SupplierExtend>(
    `/erp/supplier-extend/get?id=${id}`,
  );
}

export function createSupplierExtend(
  data: ErpSupplierExtendApi.SupplierExtend,
) {
  return requestClient.post('/erp/supplier-extend/create', data);
}

export function updateSupplierExtend(
  data: ErpSupplierExtendApi.SupplierExtend,
) {
  return requestClient.put('/erp/supplier-extend/update', data);
}

export function deleteSupplierExtend(id: number) {
  return requestClient.delete(`/erp/supplier-extend/delete?id=${id}`);
}

export function getSupplierExtendPage(
  params: PageParam & { supplierId: number },
) {
  return requestClient.get<PageResult<ErpSupplierExtendApi.SupplierExtend>>(
    '/erp/supplier-extend/page',
    { params },
  );
}
