import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpPurchaseReportApi {
  export interface PurchaseReport {
    contact?: string;
    deptId?: number;
    deptName?: string;
    docCount?: number;
    lastBizTime?: string;
    mobile?: string;
    netAmount?: number;
    purchaseAmount?: number;
    purchaseCount?: number;
    returnAmount?: number;
    returnCount?: number;
    supplierId?: number;
    supplierName?: string;
    purchaser?: string;
    purchaserName?: string;
  }

  export interface PurchaseReportSummary {
    docCount?: number;
    netAmount?: number;
    purchaseAmount?: number;
    purchaseCount?: number;
    returnAmount?: number;
    returnCount?: number;
    supplierCount?: number;
  }

  export interface PurchaseReportTrend {
    docCount?: number;
    netAmount?: number;
    period?: string;
    purchaseAmount?: number;
    purchaseCount?: number;
    returnAmount?: number;
    returnCount?: number;
  }

  export interface PurchaseProductReport {
    barCode?: string;
    brand?: string;
    docCount?: number;
    drawingNo?: string;
    lastBizTime?: string;
    netAmount?: number;
    productCode?: string;
    productId?: number;
    productName?: string;
    purchaseAmount?: number;
    purchaseCount?: number;
    returnAmount?: number;
    returnCount?: number;
    standard?: string;
    supplierCount?: number;
    unitName?: string;
    vehicleModel?: string;
  }

  export interface PurchaseReportDetail {
    bizCount?: number;
    bizId?: number;
    bizType?: number;
    docDate?: string;
    docNo?: string;
    docType?: string;
    netAmount?: number;
    purchaseAmount?: number;
    returnAmount?: number;
    rowKey?: string;
    supplierId?: number;
    supplierName?: string;
    purchaser?: string;
    purchaserName?: string;
  }

  export interface PurchaseDeptReport {
    deptId?: number;
    deptName?: string;
    docCount?: number;
    lastBizTime?: string;
    netAmount?: number;
    purchaseAmount?: number;
    purchaseCount?: number;
    returnAmount?: number;
    returnCount?: number;
    supplierCount?: number;
  }
}

export function getPurchaseReportSummary(params: Record<string, any>) {
  return requestClient.get<ErpPurchaseReportApi.PurchaseReportSummary>(
    '/erp/purchase-report/summary',
    { params },
  );
}

export function getPurchaseReportTrend(params: Record<string, any>) {
  return requestClient.get<ErpPurchaseReportApi.PurchaseReportTrend[]>(
    '/erp/purchase-report/trend',
    { params },
  );
}

export function getPurchaseReportPage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpPurchaseReportApi.PurchaseReport>>(
    '/erp/purchase-report/page',
    { params },
  );
}

export function getPurchaseReportProductPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<
    PageResult<ErpPurchaseReportApi.PurchaseProductReport>
  >('/erp/purchase-report/product-page', { params });
}

export function getPurchaseReportDeptPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<PageResult<ErpPurchaseReportApi.PurchaseDeptReport>>(
    '/erp/purchase-report/dept-page',
    { params },
  );
}

export function getPurchaseReportDetailPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<
    PageResult<ErpPurchaseReportApi.PurchaseReportDetail>
  >('/erp/purchase-report/detail-page', { params });
}

export function getPurchaseReportDeptSimpleList() {
  return requestClient.get<any[]>('/erp/purchase-report/dept-simple-list');
}

export function getPurchaseReportDetailList(params: Record<string, any>) {
  return requestClient.get<ErpPurchaseReportApi.PurchaseReportDetail[]>(
    '/erp/purchase-report/detail',
    { params },
  );
}

export function exportPurchaseReport(params: Record<string, any>) {
  return requestClient.download('/erp/purchase-report/export', { params });
}

export function exportPurchaseReportProduct(params: Record<string, any>) {
  return requestClient.download('/erp/purchase-report/export-product', {
    params,
  });
}

export function exportPurchaseReportDept(params: Record<string, any>) {
  return requestClient.download('/erp/purchase-report/export-dept', {
    params,
  });
}

export function exportPurchaseReportDetail(params: Record<string, any>) {
  return requestClient.download('/erp/purchase-report/export-detail', {
    params,
  });
}
