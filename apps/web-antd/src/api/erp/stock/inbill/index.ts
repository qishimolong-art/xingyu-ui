import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockInBillApi {
  export interface StockInBill {
    id?: number;
    priority?: string;
    no?: string;
    pickupFlag?: boolean;
    pickup?: string;
    pickupUserName?: string;
    billDate?: string;
    warehouseId?: number;
    warehouseName?: string;
    sourceUnitName?: string;
    sourceNo?: string;
    sourceBizType?: number;
    sourceId?: number;
    status?: number;
    creator?: string;
    creatorName?: string;
    createTime?: string;
    updater?: string;
    updaterName?: string;
    updateTime?: string;
    auditorName?: string;
    auditTime?: string;
    printTime?: string;
    printCount?: number;
    totalWeight?: null | number | string;
    remark?: string;
    timeoutFlag?: boolean;
    wholeQty?: number;
    looseQty?: number;
    totalCount?: null | number | string;
    pickedCount?: null | number | string;
    /** 前端根据应提数量与已提数量计算的待提数量。 */
    remainingCount?: null | number | string;
  }

  export interface StockInBillItem {
    priceVisible?: boolean;
    productPurchasePrice?: number;
    salePrice?: number;
    lastSalePrice?: number;
    minPrice?: number;
    referencePrice?: number;
    retailPrice?: number;
    lastPurchasePrice?: number;
    grossProfitRate?: number;
    backupPrice1?: number;
    wholesalePrice?: number;
    sharePrice?: number;

    id?: number;
    billId?: number;
    sourceId?: number;
    sourceItemId?: number;
    sourceNo?: string;
    warehouseId?: number;
    warehouseName?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    productUnitId?: number;
    productUnitName?: string;
    productPrice?: null | number | string;
    count?: null | number | string;
    pickedCount?: null | number | string;
    remainCount?: null | number | string;
    pickupCount?: number;
    status?: number;
    packageQty?: number;
    weight?: null | number | string;
    totalWeight?: null | number | string;
    wholeQty?: number;
    warehousePosition?: string;
    drawingNo?: string;
    batchNo?: string;
    barCode?: string;
    brand?: string;
    vehicleModel?: string;
    originPlace?: string;
    remark?: string;
  }

  export interface PickupReq {
    id: number;
    pickupTime?: string;
    remark?: string;
    items: {
      itemId: number;
      pickupCount: number;
    }[];
  }

  export interface ExportField {
    field: string;
    label: string;
    group?: string;
    groupLabel?: string;
    required?: boolean;
    sort?: number;
  }

  export interface StockInBillItemPageReq extends PageParam {
    billId: number;
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface StockInBillSummary {
    documentCount?: null | number;
    pickedCount?: null | number | string;
    remainingCount?: null | number | string;
    totalCount?: null | number | string;
  }
}

export function getStockInBillPage(params: PageParam) {
  return requestClient.get<PageResult<ErpStockInBillApi.StockInBill>>(
    '/erp/stock-in-bill/page',
    { params, timeout: 60_000 },
  );
}

export function getStockInBillSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpStockInBillApi.StockInBillSummary>(
    '/erp/stock-in-bill/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getStockInBillUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-in-bill/user-simple-page',
    { params },
  );
}

export function getStockInBill(id: number) {
  return requestClient.get<ErpStockInBillApi.StockInBill>(
    '/erp/stock-in-bill/get',
    { params: { id } },
  );
}

export function getStockInBillItems(id: number) {
  return requestClient.get<ErpStockInBillApi.StockInBillItem[]>(
    '/erp/stock-in-bill/items',
    { params: { id } },
  );
}

export function getStockInBillItemPage(
  params: ErpStockInBillApi.StockInBillItemPageReq,
) {
  return requestClient.get<PageResult<ErpStockInBillApi.StockInBillItem>>(
    '/erp/stock-in-bill/item-page',
    { params },
  );
}

export function pickupStockInBill(data: ErpStockInBillApi.PickupReq) {
  return requestClient.put('/erp/stock-in-bill/pickup', data);
}

export function exportStockInBill(params: any) {
  return requestClient.download('/erp/stock-in-bill/export-excel', { params });
}

export function getStockInBillExportFields() {
  return requestClient.get<ErpStockInBillApi.ExportField[]>(
    '/erp/stock-in-bill/export-fields',
  );
}
