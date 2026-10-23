import { requestClient } from '#/api/request';

export namespace ErpProductCategoryApi {
  /** 商品分类信息 */
  export interface ProductCategory {
    id?: number; // 分类编号
    parentId?: number; // 父分类编号
    name: string; // 分类名称
    code?: string; // 分类编码
    sort?: number; // 分类排序
    status?: number; // 开启状态
    children?: ProductCategory[]; // 子分类
  }

  export interface ProductCategoryImportResult {
    successCount?: number;
    failureCount?: number;
    createCount?: number;
    updateCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }

  export interface ProductCategoryBatchUpdate {
    ids: number[];
    status: number;
  }
}

/** 查询商品分类列表 */
export function getProductCategoryList(params?: any) {
  return requestClient.get<ErpProductCategoryApi.ProductCategory[]>(
    '/erp/product-category/list',
    { params },
  );
}

/** 查询商品分类精简列表 */
export function getProductCategorySimpleList() {
  return requestClient.get<ErpProductCategoryApi.ProductCategory[]>(
    '/erp/product-category/simple-list',
  );
}

/** 查询商品分类详情 */
/** Get next product category code */
export function getNextProductCategoryCode(parentCode?: string) {
  return requestClient.get<string>('/erp/product-category/next-code', {
    params: { parentCode },
  });
}

export function getProductCategory(id: number) {
  return requestClient.get<ErpProductCategoryApi.ProductCategory>(
    `/erp/product-category/get?id=${id}`,
  );
}

/** 新增商品分类 */
export function createProductCategory(
  data: ErpProductCategoryApi.ProductCategory,
) {
  return requestClient.post<number>('/erp/product-category/create', data);
}

/** 修改商品分类 */
export function updateProductCategory(
  data: ErpProductCategoryApi.ProductCategory,
) {
  return requestClient.put('/erp/product-category/update', data);
}

/** 批量修改商品分类 */
export function batchUpdateProductCategory(
  data: ErpProductCategoryApi.ProductCategoryBatchUpdate,
) {
  return requestClient.put('/erp/product-category/batch-update', data);
}

/** 删除商品分类 */
export function deleteProductCategory(id: number) {
  return requestClient.delete(`/erp/product-category/delete?id=${id}`);
}

/** 批量删除商品分类 */
export function deleteProductCategoryList(ids: number[]) {
  return requestClient.delete('/erp/product-category/delete-list', {
    params: { ids: ids.join(',') },
  });
}

/** 导出商品分类 Excel */
export function exportProductCategory(params: any) {
  return requestClient.download('/erp/product-category/export-excel', {
    params,
  });
}

/** 下载商品分类导入模板 */
export function getProductCategoryImportTemplate() {
  return requestClient.download('/erp/product-category/get-import-template');
}

/** 导入商品分类 */
export function importProductCategory(file: File) {
  return requestClient.upload<ErpProductCategoryApi.ProductCategoryImportResult>(
    '/erp/product-category/import',
    { file },
  );
}

/** 同步全部 ERP 分类到商城分类 */
export function syncAllProductCategoriesToMall() {
  return requestClient.post<boolean>('/erp/mall-sync/category/all');
}

/** 同步单个 ERP 分类到商城分类 */
export function syncProductCategoryToMall(id: number) {
  return requestClient.post<boolean>('/erp/mall-sync/category', null, {
    params: { id },
  });
}
