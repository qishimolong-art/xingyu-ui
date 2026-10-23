import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpProductApi {
  export interface ProductUniversal {
    id?: number;
    universalCode: string;
    universalName?: string;
    universalVehicle?: string;
  }

  export interface Product {
    id?: number;
    code?: string;
    name: string;
    pinyinCode?: string;
    wubiCode?: string;
    barCode: string;
    categoryId: number;
    categoryName?: string;
    batchNoEnabled?: boolean;
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
    brand?: string;
    oeNumber?: string;
    originPlace?: string;
    vehicleModelText?: string;
    featureCode?: string;
    drawingNo?: string;
    shelf?: string;
    defaultWarehouseId?: number;
    defaultWarehouseName?: string;
    warehouseId?: number;
    deptId?: number;
    deptIds?: number[];
    deptName?: string;
    deptNames?: string;
    openDeptNames?: string;
    vehicleModel?: string;
    factoryCode?: string;
    referencePrice?: number;
    retailPrice?: number;
    lastPurchasePrice?: number;
    grossProfitRate?: number;
    backupPrice1?: number;
    wholesalePrice?: number;
    sharePrice?: number;
    stockMax?: number;
    stockMin?: number;
    stockStandard?: number;
    packageQty?: number;
    mainImage?: string;
    detailContent?: string;
    mergedFlag?: boolean;
    mergedTargetId?: number;
    currentStock?: number;
    lockCount?: number;
    inTransitStock?: number;
    availableStock?: number;
    lowStockWarning?: boolean;
    readonlyBySaleDistribution?: boolean;
    universals?: ProductUniversal[];
    customFields?: Record<string, any>;
    creator?: number | string;
    creatorName?: string;
    createDeptId?: number;
    createDeptName?: string;
    createTime?: Date;
    updater?: number | string;
    updaterName?: string;
    updateTime?: Date;
  }

  export interface ProductImportResult {
    successCount?: number;
    failureCount?: number;
    createCount?: number;
    updateCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }

  export interface ProductImportTaskStartResult {
    taskId: number;
    reused: boolean;
  }

  export interface ProductImportTaskResult extends ProductImportResult {
    taskId: number;
    status: 'FAILURE' | 'PARTIAL_SUCCESS' | 'PROCESSING' | 'SUCCESS';
    stage: 'FINALIZING' | 'FINISHED' | 'IMPORTING' | 'PARSING' | 'QUEUED';
    stageName: string;
    progressPercent: number;
    totalCount: number;
    processedCount: number;
    fileName?: string;
    operatorName?: string;
    startTime?: string;
    endTime?: string;
    durationMs?: number;
    errorMessage?: string;
  }

  export interface ProductBatchUpdate {
    ids: number[];
    categoryId?: number;
    unitId?: number;
    defaultWarehouseId?: number;
    status?: number;
    remark?: string;
  }

  export interface StockDistributionWarehouse {
    warehouseId: number;
    warehouseCode?: string;
    warehouseName?: string;
    deptId?: number;
    deptName?: string;
    distributed?: boolean;
    defaultWarehouse?: boolean;
    stockId?: number;
    count?: number;
    lockCount?: number;
    removable?: boolean;
    disabledReason?: string;
  }

  export interface StockDistribution {
    productId: number;
    productCode?: string;
    productName?: string;
    distributedWarehouseIds?: number[];
    warehouses?: StockDistributionWarehouse[];
  }

  export interface StockDistributionSave {
    productId: number;
    warehouseIds: number[];
  }

  export interface StockDistributionBatchSave {
    productIds: number[];
    warehouseIds: number[];
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

export function getProductDetail(id: number) {
  return requestClient.get<ErpProductApi.Product>(
    `/erp/product/get-detail?id=${id}`,
  );
}

export function createProduct(data: ErpProductApi.Product) {
  return requestClient.post('/erp/product/create', data);
}

export function updateProduct(data: ErpProductApi.Product) {
  return requestClient.put('/erp/product/update', data);
}

export function getProductStockDistribution(productId: number) {
  return requestClient.get<ErpProductApi.StockDistribution>(
    '/erp/product/stock-distribution',
    { params: { productId } },
  );
}

export function updateProductStockDistribution(
  data: ErpProductApi.StockDistributionSave,
) {
  return requestClient.put<boolean>('/erp/product/stock-distribution', data);
}

export function batchUpdateProductStockDistribution(
  data: ErpProductApi.StockDistributionBatchSave,
) {
  return requestClient.put<boolean>(
    '/erp/product/stock-distribution/batch',
    data,
  );
}

export function batchUpdateProduct(data: ErpProductApi.ProductBatchUpdate) {
  return requestClient.put('/erp/product/batch-update', data);
}

export function batchDisableProduct(ids: number[]) {
  return requestClient.put('/erp/product/batch-disable', { ids });
}

export function restoreProduct(ids: number[]) {
  return requestClient.put('/erp/product/restore', { ids });
}

export function mergeProduct(data: { keepId: number; sourceId: number }) {
  return requestClient.put('/erp/product/merge', data);
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

export function startProductImportTask(file: File) {
  return requestClient.upload<ErpProductApi.ProductImportTaskStartResult>(
    '/erp/product/import-task/start',
    { file },
  );
}

export function getActiveProductImportTask() {
  return requestClient.get<ErpProductApi.ProductImportTaskResult | null>(
    '/erp/product/import-task/active',
  );
}

export function getProductImportTask(id: number) {
  return requestClient.get<ErpProductApi.ProductImportTaskResult>(
    '/erp/product/import-task/get',
    { params: { id } },
  );
}

export function updateProductsShelf(ids: number[], shelf: string) {
  return requestClient.put<boolean>('/erp/product/update-shelf', null, {
    params: { ids: ids.join(','), shelf },
  });
}

/** 同步全部 ERP 配件到商城商品 */
export function syncAllProductsToMall() {
  return requestClient.post<boolean>('/erp/mall-sync/product/all');
}

/** 同步单个 ERP 配件到商城商品 */
export function syncProductToMall(id: number) {
  return requestClient.post<boolean>('/erp/mall-sync/product', null, {
    params: { id },
  });
}
