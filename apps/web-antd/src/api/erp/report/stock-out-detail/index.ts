import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockOutDetailReportApi {
  export type DateTimeValue = number | string;

  export interface Query extends Partial<PageParam> {
    approveTime?: string[];
    businessUserId?: number;
    categoryId?: number;
    deptId?: number;
    documentTime?: string[];
    keyword?: string;
    orderDirection?: string;
    orderField?: string;
    relatedPartyId?: number;
    warehouseId?: number;
  }

  export interface Row {
    afterCancelAmount?: number;
    afterCancelCount?: number;
    approveTime?: DateTimeValue;
    brand?: string;
    businessUserId?: number;
    businessUserName?: string;
    cancelCount?: number;
    categoryId?: number;
    costAmount?: number;
    costUnitPrice?: number;
    costVisible?: boolean;
    count?: number;
    creatorName?: string;
    deptId?: number;
    deptName?: string;
    documentCategory?: string;
    documentNo?: string;
    documentTime?: DateTimeValue;
    drawingNo?: string;
    featureCode?: string;
    hiddenFields?: string[];
    itemId: number;
    itemRemark?: string;
    originPlace?: string;
    priceVisible?: boolean;
    productAmount?: number;
    productCategoryName?: string;
    productCode?: string;
    productId?: number;
    productName?: string;
    productPrice?: number;
    relatedPartyId?: number;
    relatedPartyName?: string;
    shelf?: string;
    sourceNo?: string;
    standard?: string;
    stockOutId?: number;
    totalAmount?: number;
    unitPrice?: number;
    vehicleModel?: string;
    warehouseId?: number;
    warehouseName?: string;
  }

  export interface Summary {
    costVisible?: boolean;
    hiddenFields?: string[];
    missingCostCount?: number;
    priceVisible?: boolean;
    rowCount?: number;
    totalAfterCancelAmount?: number;
    totalAfterCancelCount?: number;
    totalAmount?: number;
    totalCancelCount?: number;
    totalCostAmount?: number;
    totalCount?: number;
    totalProductAmount?: number;
  }
}

export function getStockOutDetailReportPage(
  params: ErpStockOutDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpStockOutDetailReportApi.Row>>(
    '/erp/stock-out-detail-report/page',
    { params },
  );
}

export function getStockOutDetailReportSummary(
  params: ErpStockOutDetailReportApi.Query,
) {
  return requestClient.get<ErpStockOutDetailReportApi.Summary>(
    '/erp/stock-out-detail-report/summary',
    { params },
  );
}

export function exportStockOutDetailReport(
  params: ErpStockOutDetailReportApi.Query,
) {
  return requestClient.download('/erp/stock-out-detail-report/export-excel', {
    params,
  });
}
