import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockTransferOutDetailReportApi {
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

export function getStockTransferOutDetailReportPage(
  params: ErpStockTransferOutDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpStockTransferOutDetailReportApi.Row>>(
    '/erp/stock-transfer-out-detail-report/page',
    { params },
  );
}

export function getStockTransferOutDetailReportSummary(
  params: ErpStockTransferOutDetailReportApi.Query,
) {
  return requestClient.get<ErpStockTransferOutDetailReportApi.Summary>(
    '/erp/stock-transfer-out-detail-report/summary',
    { params },
  );
}

export function exportStockTransferOutDetailReport(
  params: ErpStockTransferOutDetailReportApi.Query,
) {
  return requestClient.download(
    '/erp/stock-transfer-out-detail-report/export-excel',
    { params },
  );
}
