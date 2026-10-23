import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSystemReportApi {
  export type ReportType = 'purchase' | 'sale' | 'stock';

  export interface QueryParams extends PageParam {
    categoryId?: number;
    customerId?: number;
    deptId?: number;
    dimension?: string;
    endTime?: string;
    grain?: 'day' | 'month' | 'week';
    keyword?: string;
    metric?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    periodType?: 'custom' | 'month' | 'quarter' | 'today' | 'week' | 'year';
    purchaser?: string;
    saleUserId?: number;
    startTime?: string;
    stockStatus?: string;
    supplierId?: number;
    warehouseId?: number;
  }

  export interface OptionItem {
    label: string;
    value: number | string;
  }

  export interface Options {
    categories?: OptionItem[];
    customers?: OptionItem[];
    departments?: OptionItem[];
    suppliers?: OptionItem[];
    users?: OptionItem[];
    warehouses?: OptionItem[];
  }

  export interface Summary {
    availableQty?: number;
    customerCount?: number;
    docCount?: number;
    inAmount?: number;
    inCount?: number;
    inTransitQty?: number;
    lowStockSku?: number;
    negativeStockSku?: number;
    netAmount?: number;
    occupiedQty?: number;
    outAmount?: number;
    outCount?: number;
    pendingQty?: number;
    purchaseAmount?: number;
    purchaseCount?: number;
    returnAmount?: number;
    returnCount?: number;
    saleAmount?: number;
    saleCount?: number;
    skuCount?: number;
    stockAmount?: number;
    stockQty?: number;
    supplierCount?: number;
    zeroStockSku?: number;
  }

  export interface Trend {
    docCount?: number;
    inAmount?: number;
    inCount?: number;
    netAmount?: number;
    outAmount?: number;
    outCount?: number;
    period?: string;
    purchaseAmount?: number;
    purchaseCount?: number;
    returnAmount?: number;
    returnCount?: number;
    saleAmount?: number;
    saleCount?: number;
    stockAmount?: number;
    stockQty?: number;
  }

  export interface Rank {
    code?: string;
    count?: number;
    id?: number;
    inAmount?: number;
    lowStockSku?: number;
    name?: string;
    netAmount?: number;
    pendingQty?: number;
    returnAmount?: number;
    saleAmount?: number;
    stockAmount?: number;
    stockQty?: number;
    value?: number;
  }
}

function baseUrl(reportType: ErpSystemReportApi.ReportType, action: string) {
  return `/erp/system-report/${reportType}/${action}`;
}

export function getSystemReportOptions(
  reportType: ErpSystemReportApi.ReportType,
  params: ErpSystemReportApi.QueryParams,
) {
  return requestClient.get<ErpSystemReportApi.Options>(
    baseUrl(reportType, 'options'),
    { params },
  );
}

export function getSystemReportSummary(
  reportType: ErpSystemReportApi.ReportType,
  params: ErpSystemReportApi.QueryParams,
) {
  return requestClient.get<ErpSystemReportApi.Summary>(
    baseUrl(reportType, 'summary'),
    { params },
  );
}

export function getSystemReportTrend(
  reportType: ErpSystemReportApi.ReportType,
  params: ErpSystemReportApi.QueryParams,
) {
  return requestClient.get<ErpSystemReportApi.Trend[]>(
    baseUrl(reportType, 'trend'),
    { params },
  );
}

export function getSystemReportRank(
  reportType: ErpSystemReportApi.ReportType,
  params: ErpSystemReportApi.QueryParams,
) {
  return requestClient.get<ErpSystemReportApi.Rank[]>(
    baseUrl(reportType, 'rank'),
    { params },
  );
}

export function getSystemReportPage(
  reportType: ErpSystemReportApi.ReportType,
  params: ErpSystemReportApi.QueryParams,
) {
  return requestClient.get<PageResult<Record<string, any>>>(
    baseUrl(reportType, 'page'),
    { params },
  );
}

export function exportSystemReport(
  reportType: ErpSystemReportApi.ReportType,
  params: ErpSystemReportApi.QueryParams,
) {
  return requestClient.download(baseUrl(reportType, 'export'), { params });
}
