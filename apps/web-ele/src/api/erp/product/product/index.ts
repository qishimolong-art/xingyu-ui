import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpProductApi {
  export interface Product {
    id?: number;
    code?: string;
    name: string;
    barCode: string;
    categoryId: number;
    categoryName?: string;
    unitId: number;
    unitName?: string;
    status: number;
    standard?: string;
    remark?: string;
    expiryDay?: number;
    weight?: number;
    purchasePrice?: number;
    salePrice?: number;
    minPrice?: number;
    vehicleModel?: string;
    factoryCode?: string;
    defaultWarehouseName?: string;
    referencePrice?: number;
    retailPrice?: number;
    currentStock?: number;
    createTime?: Date | string;
  }

  export interface ProductImportResult {
    successCount?: number;
    failureCount?: number;
    createCount?: number;
    updateCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }
}

export function getProductPage(params: PageParam) {
  return requestClient.get<PageResult<ErpProductApi.Product>>(
    '/erp/product/page',
    { params },
  );
}

export function getProductSimpleList() {
  return requestClient.get<ErpProductApi.Product[]>('/erp/product/simple-list');
}

export function getProduct(id: number) {
  return requestClient.get<ErpProductApi.Product>(`/erp/product/get?id=${id}`);
}

export function createProduct(data: ErpProductApi.Product) {
  return requestClient.post('/erp/product/create', data);
}

export function updateProduct(data: ErpProductApi.Product) {
  return requestClient.put('/erp/product/update', data);
}

export function deleteProduct(id: number) {
  return requestClient.delete(`/erp/product/delete?id=${id}`);
}

export function exportProduct(params: any) {
  return requestClient.download('/erp/product/export-excel', { params });
}

export function getProductImportTemplate() {
  return requestClient.download('/erp/product/get-import-template');
}

export function importProduct(file: File) {
  return requestClient.upload<ErpProductApi.ProductImportResult>(
    '/erp/product/import',
    { file },
  );
}
