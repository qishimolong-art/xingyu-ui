import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpPartsPriceAdjustApi {
  export interface PriceAdjustFilter {
    keyword?: string;
    code?: string;
    name?: string;
    categoryId?: number;
    categoryExact?: boolean;
    vehicleModel?: string;
    supplierId?: number;
    originPlace?: string;
    brand?: string;
    warehouseId?: number;
  }

  export interface PartsItem {
    id?: number;
    code?: string;
    name?: string;
    vehicleModel?: string;
    originPlace?: string;
    brand?: string;
    standard?: string;
    supplierName?: string;
    categoryName?: string;
    currentStock?: number;
    backupPrice1?: number;
    referencePrice?: number;
    retailPrice?: number;
    wholesalePrice?: number;
    sharePrice?: number;
    purchasePrice?: number;
    salePrice?: number;
    lastPurchasePrice?: number;
    stockMax?: number;
    stockMin?: number;
    stockStandard?: number;
    customFields?: Record<string, any>;
  }

  export interface BatchUpdatePriceFieldsItem {
    id: number;
    backupPrice1?: number;
    purchasePrice?: number;
    referencePrice?: number;
    retailPrice?: number;
    wholesalePrice?: number;
    sharePrice?: number;
    salePrice?: number;
    stockMax?: number;
    stockMin?: number;
    stockStandard?: number;
    customFields?: Record<string, any>;
  }

  export interface BatchAdjustPriceReq {
    filterCondition?: PriceAdjustFilter;
    targetPriceType: string;
    sourcePriceType: string;
    adjustMethod: string;
    adjustCoefficient: number;
    decimalPlaces: number;
  }

  export interface BatchAdjustStockLimitsReq {
    filterCondition?: PriceAdjustFilter;
    stockMax?: number;
    stockMin?: number;
    stockStandard?: number;
    password: string;
  }
}

export function getProductPage(params: PageParam) {
  return requestClient.get<PageResult<ErpPartsPriceAdjustApi.PartsItem>>(
    '/erp/product/price-adjust-page',
    { params },
  );
}

export function batchUpdatePriceFields(
  data: ErpPartsPriceAdjustApi.BatchUpdatePriceFieldsItem[],
) {
  return requestClient.put<boolean>(
    '/erp/product/batch-update-price-fields',
    data,
  );
}

export function batchAdjustPrice(
  data: ErpPartsPriceAdjustApi.BatchAdjustPriceReq,
) {
  return requestClient.put<number>('/erp/product/batch-adjust-price', data);
}

export function batchUpdateStockLimits(
  data: ErpPartsPriceAdjustApi.BatchAdjustStockLimitsReq,
) {
  return requestClient.put<number>(
    '/erp/product/batch-adjust-stock-limits',
    data,
  );
}
