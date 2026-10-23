import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSaleReportApi {
  export interface SaleReport {
    contact?: string;
    customerId?: number;
    customerName?: string;
    deptId?: number;
    deptName?: string;
    docCount?: number;
    lastBizTime?: string;
    mobile?: string;
    netAmount?: number;
    returnAmount?: number;
    returnCount?: number;
    saleAmount?: number;
    saleCount?: number;
    saleUserId?: number;
    saleUserName?: string;
  }

  export interface SaleReportSummary {
    customerCount?: number;
    docCount?: number;
    netAmount?: number;
    returnAmount?: number;
    returnCount?: number;
    saleAmount?: number;
    saleCount?: number;
  }

  export interface SaleReportTrend {
    docCount?: number;
    netAmount?: number;
    period?: string;
    returnAmount?: number;
    returnCount?: number;
    saleAmount?: number;
    saleCount?: number;
  }

  export interface SaleProductReport {
    barCode?: string;
    brand?: string;
    customerCount?: number;
    docCount?: number;
    drawingNo?: string;
    lastBizTime?: string;
    netAmount?: number;
    productCode?: string;
    productId?: number;
    productName?: string;
    returnAmount?: number;
    returnCount?: number;
    saleAmount?: number;
    saleCount?: number;
    standard?: string;
    unitName?: string;
    vehicleModel?: string;
  }

  export interface SaleReportDetail {
    bizCount?: number;
    bizId?: number;
    bizType?: number;
    customerId?: number;
    customerName?: string;
    docDate?: string;
    docNo?: string;
    docType?: string;
    netAmount?: number;
    returnAmount?: number;
    rowKey?: string;
    saleAmount?: number;
  }

  export interface SaleDeptReport {
    customerCount?: number;
    deptId?: number;
    deptName?: string;
    docCount?: number;
    lastBizTime?: string;
    netAmount?: number;
    returnAmount?: number;
    returnCount?: number;
    saleAmount?: number;
    saleCount?: number;
  }
}

export function getSaleReportSummary(params: Record<string, any>) {
  return requestClient.get<ErpSaleReportApi.SaleReportSummary>(
    '/erp/sale-report/summary',
    { params },
  );
}

export function getSaleReportTrend(params: Record<string, any>) {
  return requestClient.get<ErpSaleReportApi.SaleReportTrend[]>(
    '/erp/sale-report/trend',
    { params },
  );
}

export function getSaleReportPage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpSaleReportApi.SaleReport>>(
    '/erp/sale-report/page',
    { params },
  );
}

export function getSaleReportProductPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<PageResult<ErpSaleReportApi.SaleProductReport>>(
    '/erp/sale-report/product-page',
    { params },
  );
}

export function getSaleReportDeptPage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpSaleReportApi.SaleDeptReport>>(
    '/erp/sale-report/dept-page',
    { params },
  );
}

export function getSaleReportDetailPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<PageResult<ErpSaleReportApi.SaleReportDetail>>(
    '/erp/sale-report/detail-page',
    { params },
  );
}

export function getSaleReportDeptSimpleList() {
  return requestClient.get<any[]>('/erp/sale-report/dept-simple-list');
}

export function getSaleReportDetailList(params: Record<string, any>) {
  return requestClient.get<ErpSaleReportApi.SaleReportDetail[]>(
    '/erp/sale-report/detail',
    { params },
  );
}

export function exportSaleReport(params: Record<string, any>) {
  return requestClient.download('/erp/sale-report/export', { params });
}

export function exportSaleReportProduct(params: Record<string, any>) {
  return requestClient.download('/erp/sale-report/export-product', { params });
}

export function exportSaleReportDept(params: Record<string, any>) {
  return requestClient.download('/erp/sale-report/export-dept', { params });
}

export function exportSaleReportDetail(params: Record<string, any>) {
  return requestClient.download('/erp/sale-report/export-detail', { params });
}

export function exportSaleReportDetailPage(params: Record<string, any>) {
  return requestClient.download('/erp/sale-report/export-detail-page', {
    params,
  });
}
