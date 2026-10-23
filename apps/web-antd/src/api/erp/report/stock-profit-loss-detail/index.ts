import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockProfitLossDetailReportApi {
  export interface Query extends PageParam {
    checkDate?: string[];
    checkType?: number;
    creatorKeyword?: string;
    documentNo?: string;
    keyword?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    warehouseId?: number;
  }

  export interface Row {
    actualCount?: number | string;
    adjustedUnitPrice?: number | string;
    checkDate?: number | string;
    checkId?: number;
    checkTypeName?: string;
    costUnitPrice?: number | string;
    creatorName?: string;
    documentNo?: string;
    drawingNo?: string;
    hiddenFields?: string[];
    itemId: number;
    itemRemark?: string;
    originPlace?: string;
    priceVisible?: boolean;
    productCode?: string;
    productId?: number;
    productName?: string;
    profitLossAmount?: number | string;
    profitLossCount?: number | string;
    reason?: string;
    relatedNo?: string;
    shelf?: string;
    standard?: string;
    vehicleModel?: string;
    warehouseId?: number;
    warehouseName?: string;
  }

  export interface Summary {
    hiddenFields?: string[];
    priceVisible?: boolean;
    profitLossAmount?: null | number | string;
    profitLossCount?: null | number | string;
    rowCount?: number;
  }
}

const BASE_URL = '/erp/business-report/stock-profit-loss-detail';

export function getStockProfitLossDetailPage(
  params: ErpStockProfitLossDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpStockProfitLossDetailReportApi.Row>>(
    `${BASE_URL}/page`,
    { params, timeout: 60_000 },
  );
}

export function getStockProfitLossDetailSummary(
  params: ErpStockProfitLossDetailReportApi.Query,
) {
  return requestClient.get<ErpStockProfitLossDetailReportApi.Summary>(
    `${BASE_URL}/summary`,
    { params, timeout: 30_000 },
  );
}

export function exportStockProfitLossDetail(
  params: ErpStockProfitLossDetailReportApi.Query,
) {
  return requestClient.download(`${BASE_URL}/export-excel`, { params });
}
