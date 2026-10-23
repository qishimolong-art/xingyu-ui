import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSupplierImageApi {
  export interface SupplierImage {
    id?: number;
    supplierId: number;
    imageType: string;
    imageName?: string;
    imageUrl: string;
    defaulted?: boolean;
    sort?: number;
    remark?: string;
    createTime?: string;
  }
}

export function getSupplierImageList(supplierId: number) {
  return requestClient.get<ErpSupplierImageApi.SupplierImage[]>(
    '/erp/supplier-image/list',
    { params: { supplierId } },
  );
}

export function getSupplierImage(id: number) {
  return requestClient.get<ErpSupplierImageApi.SupplierImage>(
    `/erp/supplier-image/get?id=${id}`,
  );
}

export function createSupplierImage(data: ErpSupplierImageApi.SupplierImage) {
  return requestClient.post('/erp/supplier-image/create', data);
}

export function updateSupplierImage(data: ErpSupplierImageApi.SupplierImage) {
  return requestClient.put('/erp/supplier-image/update', data);
}

export function deleteSupplierImage(id: number) {
  return requestClient.delete(`/erp/supplier-image/delete?id=${id}`);
}

export function getSupplierImagePage(
  params: PageParam & { supplierId: number },
) {
  return requestClient.get<PageResult<ErpSupplierImageApi.SupplierImage>>(
    '/erp/supplier-image/page',
    { params },
  );
}
