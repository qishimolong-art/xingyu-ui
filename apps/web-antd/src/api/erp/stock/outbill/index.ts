import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockOutBillApi {
  export interface StockOutBill {
    id?: number;
    priority?: string;
    no?: string;
    pickFlag?: boolean;
    pick?: string;
    pickUserName?: string;
    billDate?: string;
    warehouseId?: number;
    warehouseName?: string;
    shippingArea?: string;
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
    auditor?: string;
    auditorName?: string;
    auditTime?: string;
    printTime?: string;
    printCount?: number;
    sourceRemark?: string;
    totalWeight?: null | number | string;
    remark?: string;
    timeoutFlag?: boolean;
    wholeQty?: number;
    looseQty?: number;
    totalCount?: null | number | string;
    pickedCount?: null | number | string;
  }

  export interface StockOutBillItem {
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
    pickCount?: number;
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

  export interface PickReq {
    id: number;
    pickTime?: string;
    remark?: string;
    items: {
      itemId: number;
      pickCount: number;
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

  export interface StockOutBillItemPageReq extends PageParam {
    billId: number;
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface StockOutBillSummary {
    looseQty?: null | number;
    pickedCount?: null | number | string;
    totalCount?: null | number | string;
    totalWeight?: null | number | string;
    wholeQty?: null | number;
  }
}

export function getStockOutBillPage(params: PageParam) {
  return requestClient.get<PageResult<ErpStockOutBillApi.StockOutBill>>(
    '/erp/stock-out-bill/page',
    { params, timeout: 60_000 },
  );
}

export function getStockOutBillSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpStockOutBillApi.StockOutBillSummary>(
    '/erp/stock-out-bill/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getStockOutBillUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-out-bill/user-simple-page',
    { params },
  );
}

export function getStockOutBill(id: number) {
  return requestClient.get<ErpStockOutBillApi.StockOutBill>(
    '/erp/stock-out-bill/get',
    { params: { id } },
  );
}

export function getStockOutBillItems(id: number) {
  return requestClient.get<ErpStockOutBillApi.StockOutBillItem[]>(
    '/erp/stock-out-bill/items',
    { params: { id } },
  );
}

export function getStockOutBillItemPage(
  params: ErpStockOutBillApi.StockOutBillItemPageReq,
) {
  return requestClient.get<PageResult<ErpStockOutBillApi.StockOutBillItem>>(
    '/erp/stock-out-bill/item-page',
    { params },
  );
}

export const STOCK_OUT_BILL_HISTORY_NOTICE =
  '销售领货已取消，销售审核直接扣库存；历史单据仅供查询，待领数量请先核对，不会自动补扣。';

/** @deprecated 仅保留旧调用的受控错误，不再发起领货请求。 */
export function pickStockOutBill(
  _data: ErpStockOutBillApi.PickReq,
): Promise<never> {
  return Promise.reject(
    new Error('销售领货已取消，销售审核直接扣库存；历史单据仅供查询'),
  );
}

export function exportStockOutBill(params: any) {
  return requestClient.download('/erp/stock-out-bill/export-excel', { params });
}

export function getStockOutBillExportFields() {
  return requestClient.get<ErpStockOutBillApi.ExportField[]>(
    '/erp/stock-out-bill/export-fields',
  );
}
