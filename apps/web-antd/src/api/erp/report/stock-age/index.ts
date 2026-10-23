import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockAgeReportApi {
  export type Decimal = null | number | string;

  export interface Query extends Partial<PageParam> {
    ageBucket?: string;
    brand?: string;
    categoryId?: number;
    deptId?: number;
    keyword?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    outboundState?: string;
    warehouseId?: number;
  }

  export interface Row {
    ageDays?: number;
    agingBasis?: string;
    amountVisible?: boolean;
    brand?: string;
    categoryName?: string;
    costAmount?: Decimal;
    costUnitPrice?: Decimal;
    deptId?: number;
    deptName?: string;
    drawingNo?: string;
    featureCode?: string;
    lastInboundTime?: string;
    lastOutboundTime?: string;
    lastWarehouseMoveInboundTime?: string;
    months2To3Amount?: Decimal;
    months2To3Quantity?: Decimal;
    months4To6Amount?: Decimal;
    months4To6Quantity?: Decimal;
    months7To12Amount?: Decimal;
    months7To12Quantity?: Decimal;
    originPlace?: string;
    over3YearsAmount?: Decimal;
    over3YearsQuantity?: Decimal;
    productCode?: string;
    productId?: number;
    productName?: string;
    standard?: string;
    stockId: number;
    stockQuantity?: Decimal;
    vehicleModel?: string;
    warehouseId?: number;
    warehouseName?: string;
    within1MonthAmount?: Decimal;
    within1MonthQuantity?: Decimal;
    years1To2Amount?: Decimal;
    years1To2Quantity?: Decimal;
    years2To3Amount?: Decimal;
    years2To3Quantity?: Decimal;
  }

  export interface Summary {
    amountVisible?: boolean;
    months2To3Amount?: Decimal;
    months2To3Quantity?: Decimal;
    months4To6Amount?: Decimal;
    months4To6Quantity?: Decimal;
    months7To12Amount?: Decimal;
    months7To12Quantity?: Decimal;
    over3YearsAmount?: Decimal;
    over3YearsQuantity?: Decimal;
    rowCount?: number;
    totalAmount?: Decimal;
    totalQuantity?: Decimal;
    unclassifiedAmount?: Decimal;
    unclassifiedQuantity?: Decimal;
    unclassifiedRowCount?: number;
    within1MonthAmount?: Decimal;
    within1MonthQuantity?: Decimal;
    years1To2Amount?: Decimal;
    years1To2Quantity?: Decimal;
    years2To3Amount?: Decimal;
    years2To3Quantity?: Decimal;
  }
}

const BASE_URL = '/erp/business-report/stock-age';

export function getStockAgeReportPage(params: ErpStockAgeReportApi.Query) {
  return requestClient.get<PageResult<ErpStockAgeReportApi.Row>>(
    `${BASE_URL}/page`,
    { params },
  );
}

export function getStockAgeReportSummary(params: ErpStockAgeReportApi.Query) {
  return requestClient.get<ErpStockAgeReportApi.Summary>(
    `${BASE_URL}/summary`,
    { params },
  );
}

export function exportStockAgeReport(params: ErpStockAgeReportApi.Query) {
  return requestClient.download(`${BASE_URL}/export-excel`, { params });
}
