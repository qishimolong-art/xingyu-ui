import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpPurchaseOrderDetailReportApi {
  export interface Query extends Partial<PageParam> {
    factoryOrderNo?: string;
    orderDate?: [string, string];
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    orderNo?: string;
    productKeyword?: string;
    purchaserId?: number;
    supplierId?: number;
    warehouseId?: number;
  }

  export interface Row {
    brand?: string;
    count?: number;
    creatorName?: string;
    documentRemark?: string;
    drawingNo?: string;
    expectedArrivalDate?: string;
    factoryOrderNo?: string;
    featureCode?: string;
    inTransitCount?: number;
    itemId: number;
    orderDate?: string;
    orderId?: number;
    orderInTransitCount?: number;
    orderNo?: string;
    originPlace?: string;
    pendingInCount?: number;
    priceVisible?: boolean;
    productCode?: string;
    productId?: number;
    productName?: string;
    productPrice?: number;
    purchaserName?: string;
    standard?: string;
    stockCountAtOrder?: number;
    stockMax?: number;
    stockMin?: number;
    stockStandard?: number;
    supplierName?: string;
    totalPrice?: number;
    vehicleModel?: string;
    warehouseId?: number;
    warehouseName?: string;
    warehousePosition?: string;
  }

  export interface Summary {
    inTransitCount?: number;
    orderInTransitCount?: number;
    pendingInCount?: number;
    priceVisible?: boolean;
    rowCount?: number;
    totalCount?: number;
    totalPrice?: number;
  }
}

export function getPurchaseOrderDetailReportPage(
  params: ErpPurchaseOrderDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpPurchaseOrderDetailReportApi.Row>>(
    '/erp/purchase-order-detail-report/page',
    { params },
  );
}

export function getPurchaseOrderDetailReportSummary(
  params: ErpPurchaseOrderDetailReportApi.Query,
) {
  return requestClient.get<ErpPurchaseOrderDetailReportApi.Summary>(
    '/erp/purchase-order-detail-report/summary',
    { params },
  );
}

export function exportPurchaseOrderDetailReport(
  params: ErpPurchaseOrderDetailReportApi.Query,
) {
  return requestClient.download(
    '/erp/purchase-order-detail-report/export-excel',
    {
      params,
    },
  );
}
