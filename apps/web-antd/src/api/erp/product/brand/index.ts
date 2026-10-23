import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpProductBrandApi {
  /** 配件品牌 */
  export interface ProductBrand {
    id?: number;
    name: string;
    status: number;
    sort?: number;
    createTime?: string;
  }

  export interface ProductBrandImportResult {
    successCount?: number;
    failureCount?: number;
    createCount?: number;
    updateCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }
}

/** 查询配件品牌分页 */
export function getProductBrandPage(params: PageParam) {
  return requestClient.get<PageResult<ErpProductBrandApi.ProductBrand>>(
    '/erp/product-brand/page',
    { params },
  );
}

/** 查询配件品牌精简列表 */
export function getProductBrandSimpleList() {
  return requestClient.get<ErpProductBrandApi.ProductBrand[]>(
    '/erp/product-brand/list-all-simple',
  );
}

/** 查询配件品牌详情 */
export function getProductBrand(id: number) {
  return requestClient.get<ErpProductBrandApi.ProductBrand>(
    `/erp/product-brand/get?id=${id}`,
  );
}

/** 新增配件品牌 */
export function createProductBrand(data: ErpProductBrandApi.ProductBrand) {
  return requestClient.post<number>('/erp/product-brand/create', data);
}

/** 修改配件品牌 */
export function updateProductBrand(data: ErpProductBrandApi.ProductBrand) {
  return requestClient.put('/erp/product-brand/update', data);
}

/** 删除配件品牌 */
export function deleteProductBrand(id: number) {
  return requestClient.delete(`/erp/product-brand/delete?id=${id}`);
}

/** 批量删除配件品牌 */
export function batchDeleteProductBrand(ids: number[]) {
  return requestClient.delete(
    `/erp/product-brand/delete-list?ids=${ids.join(',')}`,
  );
}

/** 导出配件品牌 Excel */
export function exportProductBrand(params: any) {
  return requestClient.download('/erp/product-brand/export-excel', { params });
}

/** 下载配件品牌导入模板 */
export function getProductBrandImportTemplate() {
  return requestClient.download('/erp/product-brand/get-import-template');
}

/** 导入配件品牌 */
export function importProductBrand(file: File) {
  return requestClient.upload<ErpProductBrandApi.ProductBrandImportResult>(
    '/erp/product-brand/import',
    { file },
  );
}
