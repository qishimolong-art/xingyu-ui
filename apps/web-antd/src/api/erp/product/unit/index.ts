import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpProductUnitApi {
  /** 产品单位信息 */
  export interface ProductUnit {
    id?: number; // 单位编号
    name: string; // 单位名字
    status: number; // 单位状态
  }

  export interface ProductUnitImportResult {
    successCount?: number;
    failureCount?: number;
    createCount?: number;
    updateCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }

  export interface ProductUnitBatchUpdate {
    ids: number[];
    status: number;
  }
}

/** 查询产品单位分页 */
export function getProductUnitPage(params: PageParam) {
  return requestClient.get<PageResult<ErpProductUnitApi.ProductUnit>>(
    '/erp/product-unit/page',
    { params },
  );
}

/** 查询产品单位精简列表 */
export function getProductUnitSimpleList() {
  return requestClient.get<ErpProductUnitApi.ProductUnit[]>(
    '/erp/product-unit/simple-list',
  );
}

/** 查询产品单位详情 */
export function getProductUnit(id: number) {
  return requestClient.get<ErpProductUnitApi.ProductUnit>(
    `/erp/product-unit/get?id=${id}`,
  );
}

/** 新增产品单位 */
export function createProductUnit(data: ErpProductUnitApi.ProductUnit) {
  return requestClient.post<number>('/erp/product-unit/create', data);
}

/** 修改产品单位 */
export function updateProductUnit(data: ErpProductUnitApi.ProductUnit) {
  return requestClient.put('/erp/product-unit/update', data);
}

/** 批量修改产品单位 */
export function batchUpdateProductUnit(
  data: ErpProductUnitApi.ProductUnitBatchUpdate,
) {
  return requestClient.put('/erp/product-unit/batch-update', data);
}

/** 删除产品单位 */
export function deleteProductUnit(id: number) {
  return requestClient.delete(`/erp/product-unit/delete?id=${id}`);
}

/** 批量删除产品单位 */
export function batchDeleteProductUnit(ids: number[]) {
  return requestClient.delete(
    `/erp/product-unit/delete-list?ids=${ids.join(',')}`,
  );
}

/** 导出产品单位 Excel */
export function exportProductUnit(params: any) {
  return requestClient.download('/erp/product-unit/export-excel', { params });
}

/** 下载产品单位导入模板 */
export function getProductUnitImportTemplate() {
  return requestClient.download('/erp/product-unit/get-import-template');
}

/** 导入产品单位 */
export function importProductUnit(file: File) {
  return requestClient.upload<ErpProductUnitApi.ProductUnitImportResult>(
    '/erp/product-unit/import',
    { file },
  );
}
