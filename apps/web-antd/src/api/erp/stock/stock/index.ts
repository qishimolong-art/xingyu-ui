import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

const STOCK_PAGE_REQUEST_TIMEOUT = 60 * 1000;
const STOCK_SUMMARY_REQUEST_TIMEOUT = 60 * 1000;

export namespace ErpStockApi {
  export interface Stock {
    id?: number;
    productId: number;
    warehouseId: number;
    deptId?: number;
    deptName?: string;
    count: null | number | string;
    costPrice?: null | number | string;
    costAmount?: null | number | string;
    lockCount?: number;
    purchasePrice?: null | number | string;
    productPurchasePrice?: number;
    mainImage?: string;
    productName?: string;
    unitId?: number;
    unitName?: string;
    categoryName?: string;
    warehouseName?: string;
    productCode?: string;
    drawingNo?: string;
    standard?: string;
    featureCode?: string;
    vehicleModel?: string;
    brand?: string;
    originPlace?: string;
    shelf?: string;
    categoryId?: number;
    lastPurchasePrice?: number;
    lastSalePrice?: number;
    oeNumber?: string;
    factoryCode?: string;
    productBarCode?: string;
    salePrice?: number;
    minPrice?: number;
    referencePrice?: number;
    retailPrice?: number;
    grossProfitRate?: number;
    backupPrice1?: number;
    wholesalePrice?: number;
    sharePrice?: number;
    customFields?: Record<string, any>;
    stockMax?: number;
    stockMin?: number;
    stockStandard?: number;
    packageQty?: number;
    batchNoEnabled?: boolean;
    batchNoCount?: number;
    batchNoSummary?: string;
    batchNoList?: StockBatchNo[];
    rowKey?: string;
    batchRow?: boolean;
    batchNo?: string;
    firstInTime?: string;
    weight?: null | number | string;
    occupiedCount?: number;
    availableCount?: null | number | string;
    pendingInCount?: number;
    inTransitCount?: number;
    readonlyBySaleDistribution?: boolean;
    priceVisible?: boolean;
    currentPrice?: number;
    currentPriceAmount?: number;
  }

  export interface StockQueryReqVO {
    decimalMode?: 'string';
    batchNo?: string;
    bizType?: 'purchase' | 'sale' | 'stock';
    productId: number;
    unassignedBatch?: boolean;
    warehouseId: number;
  }

  export interface StockPageReqVO extends PageParam {
    bizType?: 'purchase' | 'sale' | 'stock';
    allSaleProduct?: boolean;
    allSaleProductPermission?: string;
    barCode?: string;
    batchNo?: string;
    brand?: string;
    categoryId?: number;
    countFilter?: number;
    countMax?: number;
    countMin?: number;
    crossDimensionKeyword?: boolean;
    deptId?: number;
    deptName?: string;
    drawingNo?: string;
    factoryCode?: string;
    featureCode?: string;
    keyword?: string;
    mergeWarehouse?: boolean;
    oeNumber?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    originPlace?: string;
    priceSystemId?: number;
    productKeyword?: string;
    productCodeNameKeyword?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    productNameKeyword?: string;
    productStatus?: number;
    positiveCountOnly?: boolean;
    saleDeptId?: number;
    shelf?: string;
    shelfDuplicateOnly?: boolean;
    shelfEmptyOnly?: boolean;
    showBatchNo?: boolean;
    standard?: string;
    stockMaxMax?: number;
    stockMaxMin?: number;
    stockMinMax?: number;
    stockMinMin?: number;
    stockStandardMax?: number;
    stockStandardMin?: number;
    vehicleModel?: string;
    warehouseId?: number;
    warehouseName?: string;
  }

  export interface StockAdjustReqVO {
    productId: number;
    warehouseId: number;
    targetCount: number | string;
    reason?: string;
    remark?: string;
  }

  export interface StockBatchNo {
    batchNo: string;
    availableCount: null | number | string;
    firstInTime?: string;
  }

  export interface StockUpdateReqVO {
    id: number;
    fieldName: string;
    shelf?: string;
    purchasePrice?: null | number | string;
    costPrice?: null | number | string;
    costAmount?: null | number | string;
  }

  export interface StockSummary {
    totalStockCount?: number;
    totalCostAmount?: null | number | string;
    totalCurrentPriceAmount?: number;
    totalPendingInCount?: number;
    totalOccupiedCount?: number;
    totalInTransitCount?: number;
    totalWeight?: null | number | string;
    totalRows?: number;
  }

  export interface MallStockSummary {
    spuId: number;
    mapped: boolean;
    mappingCount: number;
    totalAvailableCount: number;
    totalCount?: number;
    totalLockCount?: number;
    totalOccupiedCount?: number;
    totalPendingInCount?: number;
    totalInTransitCount?: number;
    warehouseStocks?: MallWarehouseStock[];
  }

  export interface MallWarehouseStock {
    warehouseId?: number;
    warehouseName?: string;
    deptId?: number;
    deptName?: string;
    shelf?: string;
    count?: number;
    lockCount?: number;
    occupiedCount?: number;
    pendingInCount?: number;
    inTransitCount?: number;
    availableCount?: number;
  }

  export interface StockInTransitDetail {
    orderId?: number;
    itemId?: number;
    no?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    warehouseId?: number;
    warehouseName?: string;
    batchNo?: string;
    count?: null | number | string;
    vehicleModel?: string;
    originPlace?: string;
    drawingNo?: string;
    standard?: string;
    createTime?: string;
    creator?: string;
    creatorName?: string;
  }

  export interface StockPendingInDetail {
    documentType?:
      | 'PURCHASE_IN'
      | 'SALE_RETURN'
      | 'STOCK_CHECK'
      | 'STOCK_IN'
      | 'STOCK_IN_BILL'
      | 'STOCK_TRANSFER_IN'
      | 'WAREHOUSE_MOVE';
    documentId?: number;
    inId?: number;
    checkId?: number;
    itemId?: number;
    no?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    warehouseId?: number;
    warehouseName?: string;
    batchNo?: string;
    count?: null | number | string;
    vehicleModel?: string;
    originPlace?: string;
    drawingNo?: string;
    standard?: string;
    createTime?: string;
    creator?: string;
    creatorName?: string;
  }

  export interface StockOccupiedDetail {
    documentType?:
      | 'PURCHASE_RETURN'
      | 'SALE_CART'
      | 'SALE_OUT'
      | 'STOCK_CHECK'
      | 'STOCK_MOVE'
      | 'STOCK_OUT'
      | 'STOCK_OUT_BILL'
      | 'WAREHOUSE_MOVE';
    documentId?: number;
    cartId?: number;
    itemId?: number;
    no?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    warehouseId?: number;
    warehouseName?: string;
    batchNo?: string;
    count?: null | number | string;
    vehicleModel?: string;
    originPlace?: string;
    drawingNo?: string;
    standard?: string;
    createTime?: string;
    creator?: string;
    creatorName?: string;
  }
}

export function getStockPage(
  params: ErpStockApi.StockPageReqVO & { decimalMode?: 'string' },
) {
  return requestClient.get<PageResult<ErpStockApi.Stock>>('/erp/stock/page', {
    params,
    timeout: STOCK_PAGE_REQUEST_TIMEOUT,
  });
}

export interface PurchaseStockPageReqVO extends PageParam {
  batchNo?: string;
  brand?: string;
  countFilter?: number;
  crossDimensionKeyword?: boolean;
  deptId?: number;
  deptName?: string;
  drawingNo?: string;
  factoryCode?: string;
  keyword?: string;
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  originPlace?: string;
  productId?: number;
  productCode?: string;
  productCodeNameKeyword?: string;
  productName?: string;
  productNameKeyword?: string;
  showBatchNo?: boolean;
  shelf?: string;
  standard?: string;
  vehicleModel?: string;
  warehouseId?: number;
  warehouseName?: string;
}

export function getPurchaseStockPage(params: PurchaseStockPageReqVO) {
  return getStockPage({
    ...params,
    bizType: 'purchase',
  });
}

export interface SaleStockPageReqVO extends PageParam {
  allSaleProduct?: boolean;
  allSaleProductPermission?: string;
  batchNo?: string;
  brand?: string;
  countFilter?: number;
  crossDimensionKeyword?: boolean;
  deptId?: number;
  deptName?: string;
  drawingNo?: string;
  factoryCode?: string;
  keyword?: string;
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  originPlace?: string;
  productId?: number;
  productCode?: string;
  productCodeNameKeyword?: string;
  productName?: string;
  productNameKeyword?: string;
  saleDeptId?: number;
  showBatchNo?: boolean;
  shelf?: string;
  standard?: string;
  vehicleModel?: string;
  warehouseId?: number;
  warehouseName?: string;
}

export function getSaleStockPage(params: SaleStockPageReqVO) {
  return getStockPage({
    ...params,
    bizType: 'sale',
  });
}

export function getStockSummary(
  params: Partial<ErpStockApi.StockPageReqVO> & { decimalMode?: 'string' },
  signal?: AbortSignal,
) {
  return requestClient.get<ErpStockApi.StockSummary>('/erp/stock/summary', {
    headers: { 'X-Silent-Error-Message': 'true' },
    params,
    signal,
    timeout: STOCK_SUMMARY_REQUEST_TIMEOUT,
  });
}

export function getMallStockSummary(spuId: number) {
  return requestClient.get<ErpStockApi.MallStockSummary>(
    '/erp/stock/mall-summary',
    {
      params: { spuId },
    },
  );
}

export function getStockCount(
  productId: number,
  warehouseId?: number,
  bizType?: 'purchase' | 'sale' | 'stock',
) {
  const params: any = { productId };
  if (warehouseId !== undefined) {
    params.warehouseId = warehouseId;
  }
  if (bizType) {
    params.bizType = bizType;
  }
  return requestClient.get<number | string>('/erp/stock/get-count', {
    params,
  });
}

export function exportStock(params: any) {
  return requestClient.download('/erp/stock/export-excel', {
    params,
  });
}

export function getWarehouseStockCount(
  params: ErpStockApi.StockQueryReqVO & { decimalMode: 'string' },
): Promise<string>;
export function getWarehouseStockCount(
  params: ErpStockApi.StockQueryReqVO,
): Promise<number>;
export function getWarehouseStockCount(params: ErpStockApi.StockQueryReqVO) {
  return requestClient.get<number | string>('/erp/stock/get-count', {
    params,
  });
}

export function getAvailableBatchNoList(params: ErpStockApi.StockQueryReqVO) {
  return requestClient.get<ErpStockApi.StockBatchNo[]>('/erp/stock/batch-nos', {
    params,
  });
}

export function getStockInTransitDetails(params: ErpStockApi.StockQueryReqVO) {
  return requestClient.get<ErpStockApi.StockInTransitDetail[]>(
    '/erp/stock/in-transit-details',
    { params },
  );
}

export function getStockPendingInDetails(params: ErpStockApi.StockQueryReqVO) {
  return requestClient.get<ErpStockApi.StockPendingInDetail[]>(
    '/erp/stock/pending-in-details',
    { params },
  );
}

export function getStockOccupiedDetails(params: ErpStockApi.StockQueryReqVO) {
  return requestClient.get<ErpStockApi.StockOccupiedDetail[]>(
    '/erp/stock/occupied-details',
    { params },
  );
}

export function updateStockShelf(ids: number[], shelf?: string) {
  return requestClient.put<boolean>('/erp/stock/update-shelf', null, {
    params: { ids: ids.join(','), shelf },
  });
}

export function updateStock(data: ErpStockApi.StockUpdateReqVO) {
  return requestClient.put<ErpStockApi.Stock>('/erp/stock/update', data);
}

export function adjustStock(data: ErpStockApi.StockAdjustReqVO) {
  return requestClient.put<number>('/erp/stock/adjust', data);
}
