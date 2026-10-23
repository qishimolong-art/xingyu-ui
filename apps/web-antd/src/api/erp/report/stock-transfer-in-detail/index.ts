import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockTransferInDetailReportApi {
  export type DateTimeValue = number | string;

  export interface Query extends Partial<PageParam> {
    amountMax?: number;
    amountMin?: number;
    countMax?: number;
    countMin?: number;
    creatorId?: number;
    documentNo?: string;
    drawingNo?: string;
    fromWarehouseId?: number;
    moveDate?: string[];
    orderDirection?: string;
    orderField?: string;
    originPlace?: string;
    priceMax?: number;
    priceMin?: number;
    productKeyword?: string;
    standard?: string;
    toWarehouseId?: number;
    vehicleModel?: string;
  }

  export interface Row {
    amountVisible?: boolean;
    costAmount?: number;
    costUnitPrice?: number;
    count?: number;
    creatorName?: string;
    documentNo?: string;
    drawingNo?: string;
    fromWarehouseId?: number;
    fromWarehouseName?: string;
    hiddenFields?: string[];
    itemId: number;
    moveDate?: DateTimeValue;
    moveId?: number;
    originPlace?: string;
    priceVisible?: boolean;
    productCode?: string;
    productId?: number;
    productName?: string;
    productPrice?: number;
    standard?: string;
    toWarehouseId?: number;
    toWarehouseName?: string;
    totalAmount?: number;
    vehicleModel?: string;
  }

  export interface Summary {
    amountVisible?: boolean;
    hiddenFields?: string[];
    priceVisible?: boolean;
    rowCount?: number;
    totalAmount?: number;
    totalCostAmount?: number;
    totalCount?: number;
  }
}

export function getStockTransferInDetailReportPage(
  params: ErpStockTransferInDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpStockTransferInDetailReportApi.Row>>(
    '/erp/stock-transfer-in-detail-report/page',
    { params },
  );
}

export function getStockTransferInDetailReportSummary(
  params: ErpStockTransferInDetailReportApi.Query,
) {
  return requestClient.get<ErpStockTransferInDetailReportApi.Summary>(
    '/erp/stock-transfer-in-detail-report/summary',
    { params },
  );
}

export function exportStockTransferInDetailReport(
  params: ErpStockTransferInDetailReportApi.Query,
) {
  return requestClient.download(
    '/erp/stock-transfer-in-detail-report/export-excel',
    { params },
  );
}
